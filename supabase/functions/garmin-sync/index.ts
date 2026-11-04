import { authenticate, createServiceClient } from '../_shared/server/context.ts'
import { HttpError, handle } from '../_shared/server/http.ts'
import { runSync, syncActivityDetail } from '../_shared/server/sync.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Runs one time-boxed sync slice (`historical` | `incremental`) or loads the detail of one activity. */
Deno.serve(
  handle(async (req, body) => {
    const db = createServiceClient()
    const userId = await authenticate(req, db)
    switch (body.kind) {
      case 'historical':
      case 'incremental':
        return runSync(db, userId, body.kind)
      case 'activity-detail': {
        if (typeof body.activityId !== 'string' || !UUID.test(body.activityId)) throw new HttpError(400, 'Invalid activity id')
        return syncActivityDetail(db, userId, body.activityId)
      }
      default:
        throw new HttpError(400, 'Unknown sync kind')
    }
  }),
)
