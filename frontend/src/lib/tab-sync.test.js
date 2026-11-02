import {expect,it,vi} from 'vitest'
import {createTabSync} from './tab-sync.js'
it('refreshes a changed domain once across tabs and ignores stale or unrelated messages',async()=>{
 const channel={postMessage:vi.fn(),close:vi.fn(),onmessage:null},refresh=vi.fn(async()=>{})
 const sync=createTabSync({accountId:'a',getRevision:()=>1,refresh,channelFactory:()=>channel})
 const receive=channel.onmessage
 receive({data:{domain:'plan',revision:2}});receive({data:{domain:'plan',revision:2}})
 receive({data:{domain:'auth',revision:3}});receive({data:{domain:'preferences',revision:1}})
 await Promise.resolve();await Promise.resolve()
 expect(refresh).toHaveBeenCalledExactlyOnceWith('plan')
 sync.publish('plan',3);expect(channel.postMessage).toHaveBeenCalledExactlyOnceWith({domain:'plan',revision:3})
 sync.dispose();expect(channel.close).toHaveBeenCalledOnce();expect(channel.onmessage).toBeNull()
})

it('reads again when another tab commits during a pending read',async()=>{
 let resolve
 const gate=new Promise(done=>{resolve=done})
 const channel={postMessage:vi.fn(),close:vi.fn(),onmessage:null}
 const refresh=vi.fn().mockImplementationOnce(()=>gate).mockResolvedValue(undefined)
 const sync=createTabSync({accountId:'a',getRevision:()=>1,refresh,channelFactory:()=>channel})
 channel.onmessage({data:{domain:'plan',revision:2}})
 await Promise.resolve()
 channel.onmessage({data:{domain:'plan',revision:3}})
 resolve();await gate;await Promise.resolve();await Promise.resolve()
 expect(refresh).toHaveBeenCalledTimes(2)
 sync.dispose()
})

it('does not lose a newer revision arriving during a follow-up read',async()=>{
 let releaseFirst,releaseSecond
 const first=new Promise(done=>{releaseFirst=done}),second=new Promise(done=>{releaseSecond=done})
 const channel={postMessage:vi.fn(),close:vi.fn(),onmessage:null}
 const refresh=vi.fn().mockImplementationOnce(()=>first).mockImplementationOnce(()=>second).mockResolvedValue(undefined)
 const sync=createTabSync({accountId:'a',getRevision:()=>1,refresh,channelFactory:()=>channel})
 channel.onmessage({data:{domain:'plan',revision:2}});await Promise.resolve()
 channel.onmessage({data:{domain:'plan',revision:3}});releaseFirst();await first;await Promise.resolve()
 channel.onmessage({data:{domain:'plan',revision:4}});releaseSecond();await second;await Promise.resolve();await Promise.resolve()
 expect(refresh).toHaveBeenCalledTimes(3);sync.dispose()
})

it('refreshes body commits across tabs using the body revision independently of plan', async () => {
 const channel={postMessage:vi.fn(),close:vi.fn(),onmessage:null}, refresh=vi.fn(async()=>{})
 const sync=createTabSync({accountId:'a',getRevision:domain=>domain==='body'?4:100,refresh,channelFactory:()=>channel})
 channel.onmessage({data:{domain:'body',revision:5}})
 channel.onmessage({data:{domain:'body',revision:4}})
 await Promise.resolve();await Promise.resolve()
 expect(refresh).toHaveBeenCalledExactlyOnceWith('body')
 sync.publish('body',6)
 expect(channel.postMessage).toHaveBeenCalledWith({domain:'body',revision:6})
 sync.dispose()
})
