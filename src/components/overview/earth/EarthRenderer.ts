import backgroundTextureURL from '@/assets/images/earth/background.jpg'
import dayTextureURL from '@/assets/images/earth/earth-day.webp'
import nightTextureURL from '@/assets/images/earth/earth-night.webp'
import surfaceTextureURL from '@/assets/images/earth/earth-surface.webp'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js'
import {
  bumpMap,
  cameraPosition,
  color,
  max,
  mix,
  normalize,
  normalLocal,
  normalWorldGeometry,
  output,
  positionWorld,
  step,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl'
import * as THREE from 'three/webgpu'
import type { EarthEndpointInfo, EarthHostTraffic, EarthLocation, EarthRoute } from './types'

const EARTH_RADIUS = 1
const ENDPOINT_RADIUS = 1.018
const ARC_SEGMENTS = 36
const UPLOAD_COLOR = new THREE.Color('#ffb45e')
const DOWNLOAD_COLOR = new THREE.Color('#64d8ff')
const LINE_ORIGIN_COLOR = new THREE.Color('#b8f7ff')
const LINE_DESTINATION_COLOR = new THREE.Color('#4f9dff')
const ROLE_COLORS = {
  origin: new THREE.Color('#ffffff'),
  destination: new THREE.Color('#5fcaff'),
} as const

interface RendererOptions {
  reducedMotion: boolean
  onEndpointHover: (info: EarthEndpointInfo | null, x?: number, y?: number) => void
}

interface RuntimeRoute {
  route: EarthRoute
  points: THREE.Vector3[]
}

interface EndpointRuntime extends EarthEndpointInfo {
  key: string
  position: THREE.Vector3
}

export interface EarthRenderer {
  setRoutes: (routes: EarthRoute[]) => void
  setInitialLocation: (location: EarthLocation) => void
  setReducedMotion: (reduced: boolean) => void
  setAutoRotation: (enabled: boolean) => void
  dispose: () => void
}

const toVector = ({ latitude, longitude }: Pick<EarthLocation, 'latitude' | 'longitude'>) => {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude)
  const longitudeRadians = THREE.MathUtils.degToRad(longitude)
  const cosLatitude = Math.cos(latitudeRadians)

  return new THREE.Vector3(
    cosLatitude * Math.cos(longitudeRadians),
    Math.sin(latitudeRadians),
    -cosLatitude * Math.sin(longitudeRadians),
  )
}

// NOAA's fractional-year approximation gives the current solar declination and
// equation of time. The resulting vector is expressed in the globe's local
// longitude/latitude coordinate system, so the day/night boundary stays attached
// to real geography even while the presentation group slowly rotates.
const getRealtimeSunDirection = (date = new Date(), target = new THREE.Vector3()) => {
  const year = date.getUTCFullYear()
  const startOfYear = Date.UTC(year, 0, 1)
  const startOfDay = Date.UTC(year, date.getUTCMonth(), date.getUTCDate())
  const dayOfYear = Math.floor((startOfDay - startOfYear) / 86_400_000) + 1
  const daysInYear = (Date.UTC(year + 1, 0, 1) - startOfYear) / 86_400_000
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  const fractionalHour = minutesUTC / 60
  const gamma = (2 * Math.PI * (dayOfYear - 1 + (fractionalHour - 12) / 24)) / daysInYear
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const longitude = THREE.MathUtils.degToRad((720 - minutesUTC - equationOfTime) / 4)
  const cosDeclination = Math.cos(declination)

  return target
    .set(
      cosDeclination * Math.cos(longitude),
      Math.sin(declination),
      -cosDeclination * Math.sin(longitude),
    )
    .normalize()
}

// Quaternion interpolation follows the shortest spherical path, including paths that
// cross ±180° longitude. It also has a deterministic antipodal fallback in three.js.
const greatCircle = (from: EarthLocation, to: EarthLocation) => {
  const start = toVector(from).normalize()
  const end = toVector(to).normalize()
  const rotation = new THREE.Quaternion().setFromUnitVectors(start, end)
  const identity = new THREE.Quaternion()
  const angle = Math.acos(THREE.MathUtils.clamp(start.dot(end), -1, 1))
  const height = 0.075 + Math.min(0.22, angle * 0.095)
  const points: THREE.Vector3[] = []

  for (let index = 0; index <= ARC_SEGMENTS; index += 1) {
    const progress = index / ARC_SEGMENTS
    const orientation = new THREE.Quaternion().slerpQuaternions(identity, rotation, progress)
    const radius = EARTH_RADIUS + Math.sin(Math.PI * progress) * height

    points.push(start.clone().applyQuaternion(orientation).normalize().multiplyScalar(radius))
  }

  return points
}

const hashProgress = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 0xffffffff
}

const samplePoints = (points: THREE.Vector3[], progress: number, target: THREE.Vector3) => {
  if (points.length === 0) return target.set(0, 0, 0)
  if (points.length === 1) return target.copy(points[0])

  const scaled = THREE.MathUtils.clamp(progress, 0, 1) * (points.length - 1)
  const index = Math.min(points.length - 2, Math.floor(scaled))

  return target.lerpVectors(points[index], points[index + 1], scaled - index)
}

const routeSignature = (routes: EarthRoute[]) =>
  routes
    .map(({ key }) => key)
    .sort()
    .join('|')

const mergeTopHosts = (...groups: EarthHostTraffic[][]) =>
  groups
    .flat()
    .sort((left, right) => right.downloaded - left.downloaded)
    .slice(0, 5)

export const createEarthRenderer = async (
  container: HTMLElement,
  options: RendererOptions,
): Promise<EarthRenderer> => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  camera.position.set(3.7, 1.55, 3.2)

  const renderer = new THREE.WebGPURenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.className = 'h-full w-full cursor-grab active:cursor-grabbing'
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  try {
    await renderer.init()
  } catch (error) {
    renderer.dispose()
    renderer.domElement.remove()
    throw error
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 2.65
  controls.maxDistance = 7.5
  controls.rotateSpeed = 0.55
  controls.zoomSpeed = 0.75
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
  // Keep browser scrolling/navigation gestures inside the canvas from competing
  // with OrbitControls on touch devices.
  renderer.domElement.style.touchAction = 'none'

  const loader = new THREE.TextureLoader()
  let loadedTextures: [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture]

  try {
    loadedTextures = await Promise.all([
      loader.loadAsync(backgroundTextureURL),
      loader.loadAsync(dayTextureURL),
      loader.loadAsync(nightTextureURL),
      loader.loadAsync(surfaceTextureURL),
    ])
  } catch (error) {
    controls.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    throw error
  }

  const [backgroundTexture, dayTexture, nightTexture, surfaceTexture] = loadedTextures
  const textures = [backgroundTexture, dayTexture, nightTexture, surfaceTexture]

  backgroundTexture.mapping = THREE.EquirectangularReflectionMapping
  backgroundTexture.colorSpace = THREE.SRGBColorSpace
  dayTexture.colorSpace = THREE.SRGBColorSpace
  nightTexture.colorSpace = THREE.SRGBColorSpace
  dayTexture.anisotropy = 8
  nightTexture.anisotropy = 8
  surfaceTexture.anisotropy = 8
  scene.background = backgroundTexture

  const sun = new THREE.DirectionalLight('#ffffff', 2)
  sun.position.set(0, 0.25, 3)
  scene.add(sun)

  const atmosphereDayColor = uniform(color('#4db2ff'))
  const atmosphereTwilightColor = uniform(color('#bc490b'))
  const roughnessLow = uniform(0.25)
  const roughnessHigh = uniform(0.38)
  const sunDirection = uniform(getRealtimeSunDirection())
  const viewDirection = positionWorld.sub(cameraPosition).normalize()
  const fresnel = viewDirection.dot(normalWorldGeometry).abs().oneMinus().toVar()
  const sunOrientation = normalLocal.dot(normalize(sunDirection)).toVar()
  const atmosphereColor = mix(
    atmosphereTwilightColor,
    atmosphereDayColor,
    sunOrientation.smoothstep(-0.25, 0.75),
  )
  const cloudsStrength = texture(surfaceTexture, uv()).b.smoothstep(0.2, 1)
  const globeMaterial = new THREE.MeshStandardNodeMaterial()

  globeMaterial.colorNode = mix(texture(dayTexture), vec3(1), cloudsStrength.mul(2))
  globeMaterial.roughnessNode = max(texture(surfaceTexture).g, step(0.01, cloudsStrength)).remap(
    0,
    1,
    roughnessLow,
    roughnessHigh,
  )

  const night = texture(nightTexture)
  const dayStrength = sunOrientation.smoothstep(-0.25, 0.5)
  const atmosphereDayStrength = sunOrientation.smoothstep(-0.5, 1)
  const atmosphereMix = atmosphereDayStrength.mul(fresnel.pow(2)).clamp(0, 1)
  let finalOutput = mix(night.rgb, output.rgb, dayStrength)
  finalOutput = mix(finalOutput, atmosphereColor, atmosphereMix)
  globeMaterial.outputNode = vec4(finalOutput, output.a)
  globeMaterial.normalNode = bumpMap(max(texture(surfaceTexture).r, cloudsStrength))

  const sphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
  const earthGroup = new THREE.Group()
  const globe = new THREE.Mesh(sphereGeometry, globeMaterial)
  earthGroup.add(globe)
  scene.add(earthGroup)

  const atmosphereMaterial = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })
  let atmosphereAlpha = fresnel.remap(0.73, 1, 1, 0).pow(3)
  atmosphereAlpha = atmosphereAlpha.mul(sunOrientation.smoothstep(-0.5, 1))
  atmosphereMaterial.outputNode = vec4(atmosphereColor, atmosphereAlpha)
  const atmosphere = new THREE.Mesh(sphereGeometry, atmosphereMaterial)
  atmosphere.scale.setScalar(1.045)
  earthGroup.add(atmosphere)

  const syncSunLight = () => {
    sun.position.copy(sunDirection.value).applyQuaternion(earthGroup.quaternion).multiplyScalar(3)
  }
  const updateSunForTime = () => {
    getRealtimeSunDirection(new Date(), sunDirection.value)
    syncSunLight()
  }
  updateSunForTime()

  let lineGeometry = new LineSegmentsGeometry()
  const lineGlowMaterial = new THREE.Line2NodeMaterial({
    color: '#ffffff',
    linewidth: 5.5,
    transparent: true,
    opacity: 0.26,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const lineMaterial = new THREE.Line2NodeMaterial({
    color: '#ffffff',
    linewidth: 1.45,
    transparent: true,
    opacity: 0.96,
    vertexColors: true,
    depthWrite: false,
  })
  const lineGlow = new LineSegments2(lineGeometry, lineGlowMaterial)
  const lines = new LineSegments2(lineGeometry, lineMaterial)
  lineGlow.frustumCulled = false
  lines.frustumCulled = false
  // InstancedBufferGeometry defaults instanceCount to Infinity. Rendering the empty
  // placeholder before the first route snapshot makes WebGPU pass Infinity to
  // drawIndexed(), which is invalid. Only reveal it after finite segment data exists.
  lineGlow.visible = false
  lines.visible = false
  lineGlow.renderOrder = 1
  lines.renderOrder = 2
  earthGroup.add(lineGlow)
  earthGroup.add(lines)

  const endpointGeometry = new THREE.SphereGeometry(0.018, 10, 8)
  const endpointMaterial = new THREE.MeshBasicNodeMaterial({ vertexColors: true })
  const particleGeometry = new THREE.SphereGeometry(0.012, 8, 6)
  const particleMaterial = new THREE.MeshBasicNodeMaterial({ vertexColors: true })
  let endpointMesh: THREE.InstancedMesh | null = null
  let particleMesh: THREE.InstancedMesh | null = null
  let endpointRuntime: EndpointRuntime[] = []
  let runtimeRoutes: RuntimeRoute[] = []
  let currentSignature = ''
  let reducedMotion = options.reducedMotion
  let autoRotation = true
  let initialLocationSet = false
  let disposed = false
  let visible = !document.hidden
  let intersecting = true
  let pinnedEndpoint = false
  const particleProgress = new Map<string, number>()
  const matrix = new THREE.Matrix4()
  const particlePosition = new THREE.Vector3()
  const particleScale = new THREE.Vector3()
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const clock = new THREE.Clock()

  const render = () => {
    if (!disposed && visible && intersecting) renderer.render(scene, camera)
  }

  const updateParticles = (delta: number, advance: boolean) => {
    if (particleMesh) {
      let instanceIndex = 0

      for (const runtime of runtimeRoutes) {
        for (const direction of ['upload', 'download'] as const) {
          const rate = runtime.route[direction]
          const phaseKey = `${runtime.route.key}:${direction}`
          let progress = particleProgress.get(phaseKey) ?? hashProgress(phaseKey)

          if (rate > 0) {
            if (advance) {
              progress =
                (progress + delta * (0.045 + Math.min(0.24, Math.log10(rate + 1) * 0.035))) % 1
            }
            particleProgress.set(phaseKey, progress)
            samplePoints(
              runtime.points,
              direction === 'download' ? 1 - progress : progress,
              particlePosition,
            )
            const size = 0.7 + Math.min(1.1, Math.log10(rate + 1) * 0.12)
            particleScale.setScalar(size)
          } else {
            particlePosition.set(0, 0, 0)
            particleScale.setScalar(0.0001)
          }

          matrix.compose(particlePosition, new THREE.Quaternion(), particleScale)
          particleMesh.setMatrixAt(instanceIndex, matrix)
          instanceIndex += 1
        }
      }

      particleMesh.instanceMatrix.needsUpdate = true
    }
  }

  const animate = () => {
    if (disposed) return

    const delta = Math.min(0.05, clock.getDelta())
    if (autoRotation) earthGroup.rotation.y += delta * 0.025
    syncSunLight()
    controls.update(delta)
    updateParticles(delta, true)

    render()
  }

  const updateAnimationLoop = () => {
    renderer.setAnimationLoop(null)
    clock.stop()

    if (!visible || !intersecting || disposed) return

    updateSunForTime()

    if (reducedMotion) {
      controls.enableDamping = false
      render()
    } else {
      controls.enableDamping = true
      clock.start()
      renderer.setAnimationLoop(animate)
    }
  }

  const rebuildEndpoints = (routes: EarthRoute[]) => {
    if (endpointMesh) earthGroup.remove(endpointMesh)

    const endpoints = new Map<string, EndpointRuntime>()

    for (const route of routes) {
      for (const point of route.path) {
        const key = `${point.role}:${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
        const existing = endpoints.get(key)

        if (existing) {
          existing.connections += route.connections
          if (point.role === 'destination') {
            existing.topHosts = mergeTopHosts(existing.topHosts, route.topHosts)
          }
        } else {
          endpoints.set(key, {
            key,
            city: point.city,
            country: point.country,
            role: point.role,
            connections: route.connections,
            topHosts: point.role === 'destination' ? route.topHosts : [],
            position: toVector(point).multiplyScalar(ENDPOINT_RADIUS),
          })
        }
      }
    }

    endpointRuntime = [...endpoints.values()]
    endpointMesh = new THREE.InstancedMesh(
      endpointGeometry,
      endpointMaterial,
      Math.max(1, endpointRuntime.length),
    )
    endpointMesh.count = endpointRuntime.length

    for (let index = 0; index < endpointRuntime.length; index += 1) {
      const endpoint = endpointRuntime[index]
      matrix.makeTranslation(endpoint.position.x, endpoint.position.y, endpoint.position.z)
      endpointMesh.setMatrixAt(index, matrix)
      endpointMesh.setColorAt(index, ROLE_COLORS[endpoint.role])
    }

    endpointMesh.instanceMatrix.needsUpdate = true
    if (endpointMesh.instanceColor) endpointMesh.instanceColor.needsUpdate = true
    earthGroup.add(endpointMesh)
  }

  const refreshEndpointCounts = (routes: EarthRoute[]) => {
    const endpointInfo = new Map<
      string,
      Pick<EarthEndpointInfo, 'city' | 'country' | 'connections' | 'topHosts'>
    >()

    for (const route of routes) {
      for (const point of route.path) {
        const key = `${point.role}:${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
        const existing = endpointInfo.get(key)

        if (existing) {
          existing.connections += route.connections
          if (point.role === 'destination') {
            existing.topHosts = mergeTopHosts(existing.topHosts, route.topHosts)
          }
        } else {
          endpointInfo.set(key, {
            city: point.city,
            country: point.country,
            connections: route.connections,
            topHosts: point.role === 'destination' ? route.topHosts : [],
          })
        }
      }
    }

    for (const endpoint of endpointRuntime) {
      const info = endpointInfo.get(endpoint.key)

      if (info) Object.assign(endpoint, info)
    }
  }

  const rebuildGeometry = (routes: EarthRoute[]) => {
    const positions: number[] = []
    const colors: number[] = []
    runtimeRoutes = []
    const activeParticleKeys = new Set<string>()

    for (const route of routes) {
      activeParticleKeys.add(`${route.key}:upload`)
      activeParticleKeys.add(`${route.key}:download`)
      const routePoints: THREE.Vector3[] = []

      for (let pathIndex = 0; pathIndex < route.path.length - 1; pathIndex += 1) {
        const from = route.path[pathIndex]
        const to = route.path[pathIndex + 1]
        const arc = greatCircle(from, to)

        routePoints.push(...(routePoints.length > 0 ? arc.slice(1) : arc))

        for (let pointIndex = 0; pointIndex < arc.length - 1; pointIndex += 1) {
          const start = arc[pointIndex]
          const end = arc[pointIndex + 1]
          const startProgress = pointIndex / (arc.length - 1)
          const endProgress = (pointIndex + 1) / (arc.length - 1)
          positions.push(start.x, start.y, start.z, end.x, end.y, end.z)
          colors.push(
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.r, LINE_DESTINATION_COLOR.r, startProgress),
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.g, LINE_DESTINATION_COLOR.g, startProgress),
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.b, LINE_DESTINATION_COLOR.b, startProgress),
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.r, LINE_DESTINATION_COLOR.r, endProgress),
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.g, LINE_DESTINATION_COLOR.g, endProgress),
            THREE.MathUtils.lerp(LINE_ORIGIN_COLOR.b, LINE_DESTINATION_COLOR.b, endProgress),
          )
        }
      }

      runtimeRoutes.push({ route, points: routePoints })
    }

    for (const key of particleProgress.keys()) {
      if (!activeParticleKeys.has(key)) particleProgress.delete(key)
    }

    const previousGeometry = lineGeometry
    lineGeometry = new LineSegmentsGeometry()

    if (positions.length > 0) {
      lineGeometry.setPositions(positions)
      lineGeometry.setColors(colors)
      lineGlow.visible = true
      lines.visible = true
    } else {
      lineGlow.visible = false
      lines.visible = false
    }

    lineGlow.geometry = lineGeometry
    lines.geometry = lineGeometry
    previousGeometry.dispose()
    rebuildEndpoints(routes)

    if (particleMesh) earthGroup.remove(particleMesh)
    particleMesh = new THREE.InstancedMesh(
      particleGeometry,
      particleMaterial,
      Math.max(1, runtimeRoutes.length * 2),
    )
    particleMesh.count = runtimeRoutes.length * 2

    for (let index = 0; index < runtimeRoutes.length; index += 1) {
      particleMesh.setColorAt(index * 2, UPLOAD_COLOR)
      particleMesh.setColorAt(index * 2 + 1, DOWNLOAD_COLOR)
    }

    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true
    earthGroup.add(particleMesh)
    updateParticles(0, false)
  }

  const setRoutes = (incomingRoutes: EarthRoute[]) => {
    const routes = [...incomingRoutes].sort((left, right) => left.key.localeCompare(right.key))
    const signature = routeSignature(routes)

    if (signature !== currentSignature) {
      currentSignature = signature
      rebuildGeometry(routes)
    } else {
      const nextByKey = new Map(routes.map((route) => [route.key, route]))

      for (const runtime of runtimeRoutes) {
        const next = nextByKey.get(runtime.route.key)
        if (next) runtime.route = next
      }
      refreshEndpointCounts(routes)
    }

    updateParticles(0, false)
    if (reducedMotion) render()
  }

  const hitTestEndpoint = (event: PointerEvent) => {
    if (!endpointMesh || endpointRuntime.length === 0) return null

    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(endpointMesh, false)[0]

    if (hit?.instanceId == null) return null
    return endpointRuntime[hit.instanceId] ?? null
  }

  const showEndpoint = (event: PointerEvent, pin = false) => {
    const endpoint = hitTestEndpoint(event)

    if (endpoint) {
      pinnedEndpoint = pin
      options.onEndpointHover(endpoint, event.clientX, event.clientY)
      renderer.domElement.style.cursor = 'pointer'
    } else if (!pinnedEndpoint || pin) {
      pinnedEndpoint = false
      options.onEndpointHover(null)
      renderer.domElement.style.cursor = ''
    }
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!pinnedEndpoint && event.pointerType !== 'touch') showEndpoint(event)
  }
  const onClick = (event: PointerEvent) => showEndpoint(event, true)
  const onPointerLeave = () => {
    if (!pinnedEndpoint) options.onEndpointHover(null)
  }
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('click', onClick)
  renderer.domElement.addEventListener('pointerleave', onPointerLeave)

  const resizeObserver = new ResizeObserver(([entry]) => {
    const width = Math.max(1, entry.contentRect.width)
    const height = Math.max(1, entry.contentRect.height)

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    render()
  })
  resizeObserver.observe(container)

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      intersecting = entry.isIntersecting
      updateAnimationLoop()
    },
    { threshold: 0.01 },
  )
  intersectionObserver.observe(container)

  const onVisibilityChange = () => {
    visible = !document.hidden
    updateAnimationLoop()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  const sunTimer = window.setInterval(() => {
    updateSunForTime()
    if (reducedMotion) render()
  }, 60_000)
  const onControlsChange = () => {
    if (reducedMotion) render()
  }
  controls.addEventListener('change', onControlsChange)
  updateAnimationLoop()

  return {
    setRoutes,
    setInitialLocation(location) {
      if (
        initialLocationSet ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        return
      }

      initialLocationSet = true
      const distance = camera.position.distanceTo(controls.target)
      const direction = toVector(location).applyQuaternion(earthGroup.quaternion).normalize()
      camera.position.copy(controls.target).addScaledVector(direction, distance)
      controls.update()
      render()
    },
    setReducedMotion(value) {
      reducedMotion = value
      updateAnimationLoop()
    },
    setAutoRotation(enabled) {
      autoRotation = enabled
    },
    dispose() {
      if (disposed) return
      disposed = true
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      window.clearInterval(sunTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      controls.removeEventListener('change', onControlsChange)
      controls.dispose()
      lineGeometry.dispose()
      lineGlowMaterial.dispose()
      lineMaterial.dispose()
      endpointGeometry.dispose()
      endpointMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      sphereGeometry.dispose()
      globeMaterial.dispose()
      atmosphereMaterial.dispose()
      textures.forEach((item) => item.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
