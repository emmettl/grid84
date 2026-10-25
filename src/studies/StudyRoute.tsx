import { lazy, useMemo } from 'react'
import type { Route } from '../route.ts'
import { StudyView } from './StudyView.tsx'
import type { Study } from './study.ts'

type StudyRoute = Extract<Route, { kind: 'study' }>
type For<Id extends StudyRoute['id']> = Extract<StudyRoute, { id: Id }>

/** Load only this scenario's data, and rebuild it only when its route changes. */
function studyPage<R extends StudyRoute>(load: () => Promise<(route: R) => Study>) {
  return lazy(async () => {
    const build = await load()
    return { default: function StudyPage({ route }: { route: R }) {
      const study = useMemo(() => build(route), [route])
      return <StudyView key={study.id} study={study} />
    } }
  })
}

const Proof = studyPage<For<'siop62'>>(async () => {
  const { SIOP62_PROOF } = await import('./siop62/proof.ts')
  return () => SIOP62_PROOF
})
const Alert = studyPage<For<'siop62-alert'>>(async () => {
  const { ALERT_FORCE, forceForOption } = await import('./siop62/alert-force.ts')
  return ({ option }) => (option === 1 ? ALERT_FORCE : forceForOption(option)).study
})
const Defcon3 = studyPage<For<'defcon3-73'>>(async () => {
  const { defcon3Execute, defcon3Giant, defcon3Posture } = await import('./defcon3/posture.ts')
  return ({ variant }) => variant === 'execute' ? defcon3Execute() : variant === 'giant' ? defcon3Giant() : defcon3Posture()
})
const Cuba = studyPage<For<'cuba-62'>>(async () => {
  const { cubaGeneral, cubaRegional } = await import('./cuba62/crisis.ts')
  return ({ general }) => general ? cubaGeneral() : cubaRegional()
})
const AbleArcher = studyPage<For<'able-archer-83'>>(async () => {
  const { ableArcher } = await import('./able-archer/war-scare.ts')
  return () => ableArcher()
})
const Tornado = studyPage<For<'tornado'>>(async () => {
  const { tornadoStrike } = await import('./tornado/tornado.ts')
  return () => tornadoStrike()
})
const SinoSoviet = studyPage<For<'sino-soviet-1969'>>(async () => {
  const { sinoSoviet69 } = await import('./sinosoviet69/sino-soviet-69.ts')
  return () => sinoSoviet69()
})
const Demolition = studyPage<For<'demolition-belt'>>(async () => {
  const { demolitionBelt } = await import('./demolition/belt.ts')
  return () => demolitionBelt()
})
const CarteBlanche = studyPage<For<'carte-blanche'>>(async () => {
  const { carteBlanche } = await import('./carteblanche/carte-blanche.ts')
  return () => carteBlanche()
})
const SevenDays = studyPage<For<'seven-days'>>(async () => {
  const { sevenDays } = await import('./sevendays/seven-days.ts')
  return () => sevenDays()
})
const VForce = studyPage<For<'v-force'>>(async () => {
  const { vForce } = await import('./vforce/vforce.ts')
  return ({ profile }) => vForce(profile)
})
const Window = studyPage<For<'window-83'>>(async () => {
  const { window83 } = await import('./window83/window.ts')
  return ({ posture }) => window83(posture)
})
const SeventyTwo = studyPage<For<'72-minutes'>>(async () => {
  const { seventyTwoMinutes } = await import('./minutes72/scenario.ts')
  return ({ variant }) => seventyTwoMinutes(variant)
})
const Britain = studyPage<For<'britain-80'>>(async () => {
  const { britainSquareLeg, britainStrath } = await import('./britain/protect.ts')
  return ({ strath }) => strath ? britainStrath() : britainSquareLeg()
})

export function StudyRoute({ route }: { route: StudyRoute }) {
  switch (route.id) {
    case 'siop62': return <Proof route={route} />
    case 'siop62-alert': return <Alert route={route} />
    case 'defcon3-73': return <Defcon3 route={route} />
    case 'cuba-62': return <Cuba route={route} />
    case 'able-archer-83': return <AbleArcher route={route} />
    case 'tornado': return <Tornado route={route} />
    case 'sino-soviet-1969': return <SinoSoviet route={route} />
    case 'demolition-belt': return <Demolition route={route} />
    case 'carte-blanche': return <CarteBlanche route={route} />
    case 'seven-days': return <SevenDays route={route} />
    case 'v-force': return <VForce route={route} />
    case 'window-83': return <Window route={route} />
    case '72-minutes': return <SeventyTwo route={route} />
    case 'britain-80': return <Britain route={route} />
  }
}
