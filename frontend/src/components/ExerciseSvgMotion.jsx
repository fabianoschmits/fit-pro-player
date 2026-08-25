import { useEffect, useMemo, useRef } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseSvgMotion } from '../lib/exercise-svg-motions.js'
import ExerciseVisual from './ExerciseVisual.jsx'

const UPPER_ARM = 46
const FOREARM = 42
const THIGH = 58
const SHIN = 55
const CONTROLLED_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)'

function rotate([x, y], angle) {
  const radians = angle * Math.PI / 180
  return [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)]
}

function add([ax, ay], [bx, by]) {
  return [ax + bx, ay + by]
}

function endOf([x, y], angle, length) {
  const radians = angle * Math.PI / 180
  return [x - Math.sin(radians) * length, y + Math.cos(radians) * length]
}

const round = value => Math.round(value * 100) / 100
const move = ([x, y], angle) => `translate(${round(x)}px, ${round(y)}px) rotate(${round(angle)}deg)`
const footMove = ([x, y], [dx, dy], angle) =>
  `translate(${round(x + dx)}px, ${round(y + dy)}px) rotate(${round(angle)}deg)`

function lineMove(start, end) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.hypot(dx, dy)
  const angle = Math.atan2(-dx, dy) * 180 / Math.PI
  return `${move(start, angle)} scaleY(${round(length / 100)})`
}

function angleTo(start, end) {
  return Math.atan2(-(end[0] - start[0]), end[1] - start[1]) * 180 / Math.PI
}

function solveElbow(shoulder, wrist, bend) {
  const dx = wrist[0] - shoulder[0]
  const dy = wrist[1] - shoulder[1]
  const rawDistance = Math.hypot(dx, dy)
  const distance = Math.min(UPPER_ARM + FOREARM - 0.01, Math.max(Math.abs(UPPER_ARM - FOREARM) + 0.01, rawDistance))
  const ux = dx / (rawDistance || 1)
  const uy = dy / (rawDistance || 1)
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + distance ** 2) / (2 * distance)
  const height = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - along ** 2))
  return [
    shoulder[0] + ux * along - uy * height * bend,
    shoulder[1] + uy * along + ux * height * bend,
  ]
}

function armRig(shoulder, defaultUpper, defaultForearm, wristTarget, bend) {
  if (!wristTarget) {
    const elbow = endOf(shoulder, defaultUpper, UPPER_ARM)
    return {
      upper: move(shoulder, defaultUpper),
      forearm: move(elbow, defaultForearm),
      wrist: endOf(elbow, defaultForearm, FOREARM),
    }
  }
  const elbow = solveElbow(shoulder, wristTarget, bend)
  return {
    upper: move(shoulder, angleTo(shoulder, elbow)),
    forearm: move(elbow, angleTo(elbow, wristTarget)),
    wrist: wristTarget,
  }
}

function rigOf(pose, cable, profile = false) {
  const hip = pose.hip
  const shoulderHalf = profile ? 10 : 29
  const hipHalf = profile ? 6 : 14
  const shoulderL = add(hip, rotate([-shoulderHalf, -68], pose.torso))
  const shoulderR = add(hip, rotate([shoulderHalf, -68], pose.torso))
  const hipL = add(hip, rotate([-hipHalf, -2], pose.torso))
  const hipR = add(hip, rotate([hipHalf, -2], pose.torso))
  const head = add(hip, rotate([0, -111], pose.torso))
  const headWristL = pose.arms === 'head' ? add(head, rotate([-18, 6], pose.torso)) : null
  const headWristR = pose.arms === 'head' ? add(head, rotate([18, 6], pose.torso)) : null
  const armL = armRig(shoulderL, pose.upperArmL, pose.forearmL, pose.wristL || headWristL, pose.armBendL ?? -1)
  const armR = armRig(shoulderR, pose.upperArmR, pose.forearmR, pose.wristR || headWristR, pose.armBendR ?? 1)
  const kneeL = endOf(hipL, pose.thighL, THIGH)
  const kneeR = endOf(hipR, pose.thighR, THIGH)
  const ankleL = endOf(kneeL, pose.shinL, SHIN)
  const ankleR = endOf(kneeR, pose.shinR, SHIN)

  const rig = {
    torso: move(hip, pose.torso),
    upperArmL: armL.upper,
    forearmL: armL.forearm,
    upperArmR: armR.upper,
    forearmR: armR.forearm,
    thighL: move(hipL, pose.thighL),
    shinL: move(kneeL, pose.shinL),
    footL: footMove(ankleL, pose.footShiftL, pose.footL),
    thighR: move(hipR, pose.thighR),
    shinR: move(kneeR, pose.shinR),
    footR: footMove(ankleR, pose.footShiftR, pose.footR),
  }
  if (cable) {
    rig.cableL = lineMove(cable.anchors[0], armL.wrist)
    rig.cableR = lineMove(cable.anchors[1], armR.wrist)
  }
  return rig
}

function closestPose(config) {
  let closest = 0
  let distance = Infinity
  config.offsets.forEach((offset, index) => {
    const next = Math.abs(offset - config.poster)
    if (next < distance) {
      closest = index
      distance = next
    }
  })
  return config.poses[closest]
}

function Torso({ view, target, transform }) {
  const back = view === 'back'
  return (
    <g className={'svg-body svg-torso ' + (back ? 'is-back' : 'is-front')} data-motion="torso" style={{ transform }}>
      <ellipse className="svg-body-fill svg-head" cx="0" cy="-111" rx="15.5" ry="20" />
      <path className="svg-body-fill" d="M-12-91c-13 2-17 10-22 20-3 7-2 15 2 22 5 10 8 19 9 31 1 8 5 14 9 18h28c4-4 8-10 9-18 1-12 4-21 9-31 4-7 5-15 2-22-5-10-9-18-22-20l-2 9H-10z" />
      <path className="svg-body-fill svg-pelvis" d="M-17-5c5 3 29 3 34 0l4 14c-9 5-33 5-42 0z" />
      {back ? (
        <>
          <path className={target === 'lats' ? 'svg-muscle is-active' : 'svg-muscle'} d="M-27-65c4 7 6 13 7 24 1 8 4 14 8 19l8-7-3-38z" />
          <path className={target === 'lats' ? 'svg-muscle is-active' : 'svg-muscle'} d="M27-65c-4 7-6 13-7 24-1 8-4 14-8 19l-8-7 3-38z" />
          <path className="svg-body-detail" d="M0-82v54M-18-70C-10-64-6-59 0-49M18-70C10-64 6-59 0-49M-18-24c7-5 12-7 18-7s11 2 18 7" />
        </>
      ) : (
        <>
          <path className={target === 'pectorals' ? 'svg-muscle is-active' : 'svg-muscle'} d="M-25-69c8-8 18-8 24-1l-1 17c-9 5-18 3-24-3z" />
          <path className={target === 'pectorals' ? 'svg-muscle is-active' : 'svg-muscle'} d="M25-69c-8-8-18-8-24-1l1 17c9 5 18 3 24-3z" />
          <g className={target === 'abs' || target === 'core' ? 'svg-abs is-active' : 'svg-abs'}>
            <path d="M-9-48h8v13h-9zM1-48h8l1 13H1zM-10-32h9v13h-10zM1-32h9l1 13H1zM-10-16h9v11h-9zM1-16h9v11H1z" />
          </g>
          <path className={target === 'obliques' || target === 'core' ? 'svg-muscle is-active' : 'svg-muscle'} d="M-22-48c-4 8-4 24 3 36l8-5-2-31z" />
          <path className={target === 'obliques' || target === 'core' ? 'svg-muscle is-active' : 'svg-muscle'} d="M22-48c4 8 4 24-3 36l-8-5 2-31z" />
          <path className="svg-body-detail" d="M0-82v19M-24-51c7 2 14 2 24-1 10 3 17 3 24 1M0-49v44M-12-34h24M-12-18h24" />
        </>
      )}
      <path className="svg-body-detail" d="M-9-90C-6-84 6-84 9-90M-17-5c9 4 25 4 34 0" />
    </g>
  )
}

function UpperArm({ side, transform }) {
  return (
    <g className={'svg-body svg-upper-arm side-' + side} data-motion={'upperArm' + side} style={{ transform }}>
      <path className="svg-body-fill" d="M-7 0C-10 10-9 21-7 31l2 15H5l2-15c2-10 3-21-7-31z" />
      <path className="svg-body-detail" d="M-5 10C1 7 5 10 6 18M-5 27c4 3 7 3 11 0" />
      <circle className="svg-joint" cy="45" r="5" />
    </g>
  )
}

function Forearm({ side, transform }) {
  return (
    <g className={'svg-body svg-forearm side-' + side} data-motion={'forearm' + side} style={{ transform }}>
      <path className="svg-body-fill" d="M-5 0C-7 11-6 25-4 38H4c2-13 3-27 1-38z" />
      <path className="svg-body-detail" d="M-3 8c4 4 4 15 1 25" />
      <path className="svg-body-fill svg-hand" d="M-4 37c-3 7 0 12 4 12s7-5 4-12z" />
    </g>
  )
}

function Thigh({ side, active, transform }) {
  return (
    <g className={'svg-body svg-thigh side-' + side} data-motion={'thigh' + side} style={{ transform }}>
      <path className="svg-body-fill" d="M-10 0c-3 16-1 35 3 55H7c4-20 6-39-7-55z" />
      <path className={active ? 'svg-limb-muscle is-active' : 'svg-limb-muscle'} d="M-7 6c-2 14 0 30 4 43h6C7 35 9 19 6 6 2 3-2 3-7 6z" />
      <path className="svg-body-detail" d="M-6 13c6-5 11-2 12 6M-4 37c4 3 7 3 10 0" />
      <circle className="svg-joint" cy="57" r="5.5" />
    </g>
  )
}

function Shin({ side, active, transform }) {
  return (
    <g className={'svg-body svg-shin side-' + side} data-motion={'shin' + side} style={{ transform }}>
      <path className="svg-body-fill" d="M-7 0c-2 13-1 31 2 53H5c3-22 4-40-5-53z" />
      <path className={active ? 'svg-limb-muscle is-active' : 'svg-limb-muscle'} d="M-5 7c-2 10-1 25 2 35h5C6 30 7 16 4 7 1 4-2 4-5 7z" />
      <path className="svg-body-detail" d="M-4 12c4-3 7-1 8 6M-3 38c3 2 5 2 7 0" />
      <circle className="svg-joint" cy="54" r="4.5" />
    </g>
  )
}

function Foot({ side, transform }) {
  const direction = side === 'L' ? -1 : 1
  return (
    <g className={'svg-body svg-foot side-' + side} data-motion={'foot' + side} style={{ transform }}>
      <path className="svg-body-fill" d={`M0-5c${7 * direction} 0 ${15 * direction} 3 ${21 * direction} 8 ${2 * direction} 4 ${-1 * direction} 8 ${-6 * direction} 8H0z`} />
      <path className="svg-body-detail" d={`M${4 * direction} 4h${11 * direction}`} />
    </g>
  )
}

function Equipment({ items }) {
  return (
    <g className="svg-equipment" aria-hidden="true">
      {items.map((item, index) => {
        if (item.type === 'floor') return <path key={index} className="svg-ground" d={`M50 ${item.y}H310`} />
        if (item.type === 'mat') return (
          <rect key={index} className="svg-mat" x={item.x} y={item.y} width={item.width} height={item.height} rx="12" transform={`rotate(${item.rotate} ${item.x + item.width / 2} ${item.y + item.height / 2})`} />
        )
        if (item.type === 'bar') return (
          <g key={index}>
            <path className="svg-bar" d={`M74 ${item.y}H286`} />
            <path className="svg-grip" d={`M102 ${item.y}h25M233 ${item.y}h25`} />
          </g>
        )
        if (item.type === 'cable') return (
          <g key={index}>
            <path className="svg-machine" d="M70 258V22h220v236M70 45h220M120 258h-70M240 258h70" />
            {item.anchors.map(([x, y], pulley) => <circle key={pulley} className="svg-pulley" cx={x} cy={y} r="7" />)}
            <path className="svg-seat" d="M145 169h70M154 169v69M206 169v69M143 238h74" />
          </g>
        )
        if (item.type === 'ankle-guide') {
          const [cx, cy] = item.center
          return (
            <g key={index} className="svg-ankle-guide">
              <path d={`M${cx - 22} ${cy}a22 13 0 1 1 39 8`} />
              <path className="svg-guide-arrow" d={`M${cx + 17} ${cy + 8}l-9-1 5 8z`} />
            </g>
          )
        }
        return null
      })}
    </g>
  )
}

function AnimatedCables({ cable, transforms }) {
  if (!cable) return null
  return (
    <g className="svg-cables" aria-hidden="true">
      <g data-motion="cableL" style={{ transform: transforms.cableL }}><path d="M0 0V100" /></g>
      <g data-motion="cableR" style={{ transform: transforms.cableR }}><path d="M0 0V100" /></g>
    </g>
  )
}

export default function ExerciseSvgMotion({ ex, playing }) {
  const config = exerciseSvgMotion(ex)
  const svgRef = useRef(null)
  const animationsRef = useRef([])
  const visibleRef = useRef(true)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const cable = config?.equipment.find(item => item.type === 'cable')
  const rigs = useMemo(() => config?.poses.map(item => rigOf(item, cable, config.profile)) || [], [config, cable])
  const posterRig = useMemo(() => config ? rigOf(closestPose(config), cable, config.profile) : null, [config, cable])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !config || typeof Element === 'undefined' || !Element.prototype.animate) return undefined
    let observer

    animationsRef.current = [...svg.querySelectorAll('[data-motion]')].map(node => {
      const name = node.dataset.motion
      const animation = node.animate(rigs.map((rig, index) => ({
        transform: rig[name],
        offset: config.offsets[index],
        easing: index === rigs.length - 1 ? undefined : CONTROLLED_EASE,
      })), {
        duration: config.duration,
        iterations: Infinity,
        easing: 'linear',
        fill: 'both',
      })
      animation.pause()
      animation.currentTime = config.poster * config.duration
      return animation
    })

    const syncPlayback = () => {
      const shouldPlay = playingRef.current && visibleRef.current && !document.hidden
      animationsRef.current.forEach(animation => shouldPlay ? animation.play() : animation.pause())
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        visibleRef.current = entry.isIntersecting
        syncPlayback()
      }, { threshold: 0.08 })
      observer.observe(svg)
    }
    const onVisibility = () => syncPlayback()
    document.addEventListener('visibilitychange', onVisibility)
    syncPlayback()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      animationsRef.current.forEach(animation => animation.cancel())
      animationsRef.current = []
    }
  }, [config, rigs])

  useEffect(() => {
    const shouldPlay = playing && visibleRef.current && !document.hidden
    animationsRef.current.forEach(animation => shouldPlay ? animation.play() : animation.pause())
  }, [playing])

  if (!config || !posterRig) return <ExerciseVisual ex={ex} />

  const quads = config.target === 'quads'
  const calves = config.target === 'calves'
  return (
    <div className="exercise-svg-motion" data-exercise-svg={ex.id}>
      <svg ref={svgRef} viewBox="0 0 360 280" role="img" aria-label={exerciseName(ex)} focusable="false">
        <title>{exerciseName(ex)}</title>
        <Equipment items={config.equipment} />
        <AnimatedCables cable={cable} transforms={posterRig} />

        <g className="svg-figure is-far" aria-hidden="true">
          <UpperArm side="L" transform={posterRig.upperArmL} />
          <Forearm side="L" transform={posterRig.forearmL} />
          <Thigh side="L" active={quads} transform={posterRig.thighL} />
          <Shin side="L" active={calves} transform={posterRig.shinL} />
          <Foot side="L" transform={posterRig.footL} />
        </g>
        <Torso view={config.view} target={config.target} transform={posterRig.torso} />
        <g className="svg-figure is-near" aria-hidden="true">
          <UpperArm side="R" transform={posterRig.upperArmR} />
          <Forearm side="R" transform={posterRig.forearmR} />
          <Thigh side="R" active={quads} transform={posterRig.thighR} />
          <Shin side="R" active={calves} transform={posterRig.shinR} />
          <Foot side="R" transform={posterRig.footR} />
        </g>
      </svg>
    </div>
  )
}
