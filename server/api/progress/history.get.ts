export default defineEventHandler(async (event) => {
    const {user} = await requireUserSession(event)
    const history = await videoProgress.find({userId: user.id})
        .sort({updatedAt: -1})
        .lean()
    return history
})
