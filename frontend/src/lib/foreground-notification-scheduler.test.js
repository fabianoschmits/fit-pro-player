// @vitest-environment happy-dom
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import { createForegroundNotificationScheduler } from './foreground-notification-scheduler.js'
let S,notify,background
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,5,15,59));localStorage.clear();Object.defineProperty(document,'hidden',{configurable:true,value:false});S={notifications:{workoutReminder:true,trainingTime:'18:00',leadMinutes:120},planMode:'weekly',week:{1:'r'},dayPlan:{},routines:[{id:'r',ex:[{}]}]};notify=vi.fn();background=false})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})
const make=scope=>createForegroundNotificationScheduler({scope,getState:()=>S,backgroundEnabled:()=>background,notify})
it('delivers at the local calendar deadline without API polling and persists receipts',async()=>{
  const s=make('user1');s.sync();await vi.advanceTimersByTimeAsync(60000);expect(notify).toHaveBeenCalledOnce();s.sync();s.dispose()
  const next=make('user1');next.sync();await vi.advanceTimersByTimeAsync(1000);expect(notify).toHaveBeenCalledOnce();next.dispose()
})
it('does not alert in background or duplicate server managed reminders',async()=>{
  const s=make('user1');s.sync();Object.defineProperty(document,'hidden',{configurable:true,value:true});await vi.advanceTimersByTimeAsync(60000);expect(notify).not.toHaveBeenCalled()
  Object.defineProperty(document,'hidden',{configurable:true,value:false});background=true;s.sync();await vi.advanceTimersByTimeAsync(60000);expect(notify).not.toHaveBeenCalled();s.dispose()
})
it('rechecks a completed workout and keeps receipts scoped to each account',async()=>{
  const s=make('user1');s.sync();S.workouts=[{d:'2026-10-05'}];await vi.advanceTimersByTimeAsync(60000);expect(notify).not.toHaveBeenCalled();s.dispose()
  S.workouts=[];const other=make('user2');other.sync();await vi.advanceTimersByTimeAsync(1);expect(notify).toHaveBeenCalledOnce();other.dispose()
})
