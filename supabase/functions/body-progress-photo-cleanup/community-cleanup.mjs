const check = result => { if (result.error) throw new Error('operation failed'); return result.data }

export async function removeCommunityPost({ db, store, owner, postId }) {
  const post = check(await db.from('community_posts').select('image_path').eq('author_id', owner).eq('id', postId).maybeSingle())
  if (!post) return // Idempotent retry after a lost successful response.
  let path = post.image_path
  for (const marker of ['/object/public/community-posts/', '/object/sign/community-posts/']) {
    if (path.includes(marker)) path = decodeURIComponent(path.split(marker)[1].split('?')[0])
  }
  if (!path.startsWith(`${owner}/`) || path.includes('..')) throw new Error('invalid path')
  check(await store.remove([path]))
  // Keep metadata on failure, so another attempt can finish the operation.
  check(await db.from('community_posts').delete().eq('author_id', owner).eq('id', postId))
}

export async function removeAccountObjects({ store, owner }) {
  const paths = []
  async function collect(prefix) {
    for (let offset = 0; ; offset += 100) {
      const page = check(await store.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }))
      for (const item of page) {
        if (!item.name || item.name.includes('/') || item.name === '..' || item.name === '.') throw new Error('invalid path')
        const path = `${prefix}/${item.name}`
        if (item.id) paths.push(path)
        else await collect(path)
      }
      if (page.length < 100) break
    }
  }
  await collect(owner)
  for (let i = 0; i < paths.length; i += 100) check(await store.remove(paths.slice(i, i + 100)))
}
