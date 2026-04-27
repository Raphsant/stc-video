import {videoProgress} from "#server/models/VideoProgress";

export default defineEventHandler(async (event) => {
    //Get the user session to get the user id
    const {user} = await requireUserSession(event)
    //Get the video key from the URL
    const videoKey = decodeURIComponent(getRouterParam(event, 'key')!)
    //Search for the progress in the database
    //@ts-ignore
    const progress = await videoProgress.findOne({userId: user.id, videoKey})

    return {timestamp: progress?.timestamp ?? 0}
})
