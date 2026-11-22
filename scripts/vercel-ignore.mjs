// Studio renders editorial content behind authentication; it does not need a public branch deployment.
process.exit(process.env.VERCEL_GIT_COMMIT_REF === "cms/editorial" ? 0 : 1);
