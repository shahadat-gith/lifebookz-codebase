import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";
import * as upload from "../controllers/upload.controller.js";

const router = Router();

// Presigned PUT URLs come from the single upload controller — story media
// (author side) as well as avatars and covers (dashboards) mint here.
const anyAccount = [authenticate, authorize("user", "author", "expert")];

router.post("/presign", anyAccount, upload.presignUpload);

// Remove an object the caller stopped using (client-supplied key, folder-
// scoped so only platform uploads can go).
router.delete("/", anyAccount, upload.deleteUpload);

export default router;
