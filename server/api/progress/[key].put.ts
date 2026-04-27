export default defineEventHandler(async (event) => {
    const {user} = await requireUserSession(event)
    const videoKey = decodeURIComponent(getRouterParam(event, 'key')!)
    const {timestamp, duration} = await readBody(event)

    await videoProgress.findOneAndUpdate(
        {userId: user.id, videoKey, duration},
        {$set: {timestamp}},
        {upsert: true},
    )

    return {ok: true}
})
