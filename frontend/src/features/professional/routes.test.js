import { expect, it } from 'vitest'
import { isProfessionalRoute, professionalPath, preserveProfessionalIdentity } from './routes.js'
it('covers the approved professional tree with safely encoded exact identities', () => {
  for (const [kind, suffix] of Object.entries({program:'',programEdit:'/edit',programWorkout:'/workouts/monday',programWorkoutEdit:'/edit/monday',programVersions:'/versions',programVersion:'/versions/v%2F1',programCompare:'/versions/compare',programAssign:'/assign?version=v%2F1&student=s%2F1'})) {
    expect(professionalPath({kind,id:'p/1',day:'monday',versionId:'v/1',studentId:'s/1'})).toBe('/professional/programs/p%2F1'+suffix)
  }
  for (const [kind, suffix] of Object.entries({student:'',studentTraining:'/training',studentAssign:'/assign',studentHistory:'/history',studentExecution:'/history/e%2F1',studentProgress:'/progress'})) {
    expect(professionalPath({kind,id:kind === 'studentExecution' ? 'e/1' : 's/1',studentId:'s/1'})).toBe('/professional/students/s%2F1'+suffix)
  }
  expect(professionalPath({kind:'profileEdit'})).toBe('/professional/profile/edit')
  expect(professionalPath({kind:'exercises'})).toBe('/professional/exercises')
})
it('legacy_links_keep_exact_identity without silently selecting another material or version', () => {
  const query='?program=p%2F1&version=v%2F2&material=a%2F3&code=C%204&section=training'
  expect(preserveProfessionalIdentity('/professional/students/s', query)).toBe('/professional/students/s'+query)
  expect(isProfessionalRoute('/professional-profile')).toBe(true)
  expect(isProfessionalRoute('/professional/profile/edit')).toBe(true)
  expect(isProfessionalRoute('/professional/students/s/history/e')).toBe(true)
  expect(isProfessionalRoute('/student/professionals')).toBe(false)
  expect(isProfessionalRoute('/professional-other')).toBe(false)
})
it('rejects missing identities and unknown route kinds instead of manufacturing a destination', () => {
  expect(() => professionalPath({kind:'program'})).toThrow()
  expect(() => professionalPath({kind:'programWorkout',id:'p',day:'bad'})).toThrow()
  expect(() => professionalPath({kind:'unknown'})).toThrow()
})
