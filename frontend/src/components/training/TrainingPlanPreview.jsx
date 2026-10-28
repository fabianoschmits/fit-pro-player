import { useState } from 'react'
import TrainingPlanWorkspace from './TrainingPlanWorkspace.jsx'
import ExerciseCard from './ExerciseCard.jsx'
export default function TrainingPlanPreview({ state }) {
 const [routineId,setRoutineId]=useState(null)
 const routine=state.routines.find(item=>item.id===routineId)
 return <><TrainingPlanWorkspace state={state} onOpen={setRoutineId}/>{routine&&<section><h3>{routine.name}</h3>{routine.ex.map((entry,index)=><ExerciseCard key={index} entry={entry}/>)}</section>}</>
}
