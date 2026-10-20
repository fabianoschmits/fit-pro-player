// @vitest-environment happy-dom
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('./BodyMap.jsx', () => ({ default: props => <div data-view={props.view} data-region={props.region} data-chest={props.load.chest || 0} data-back={props.load['upper-back'] || 0} /> }))

import WorkoutMuscleThumb from './WorkoutMuscleThumb.jsx'

it('builds the historical muscle silhouette from completed sets without needing the old routine', () => {
  const workout = { id: 'historical-1', routineId: 'deleted-routine', entries: [{ id: '0025', sets: [{ done: true, w: 60, r: 8 }] }] }
  const markup = renderToStaticMarkup(<WorkoutMuscleThumb workout={workout} body="male" />)
  expect(markup).toContain('data-view="front"')
  expect(markup).toContain('data-chest="1"')
})
