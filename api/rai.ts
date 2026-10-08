import snapshot from '../server/rai/analytics-snapshot.js';
import connection from '../server/rai/connection.js';
import { createRaiRouter } from '../server/rai/router.js';

export default createRaiRouter({ snapshot, connection });
