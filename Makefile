GENERATED_FILES += dist/aws-lambda/dist/index.mjs dist/aws-lambda/dist/index.mjs.map
GENERATED_FILES += dist/azure-function/dist/index.mjs dist/azure-function/dist/index.mjs.map
GENERATED_FILES += dist/cloudflare-worker/dist/index.js dist/cloudflare-worker/dist/index.js.map
GENERATED_FILES += dist/gcp-cloud-run/dist/index.mjs dist/gcp-cloud-run/dist/index.mjs.map

JS_TSC_TYPECHECK_SKIP_LIB := true

-include .makefiles/Makefile
-include .makefiles/pkg/js/v1/Makefile
-include .makefiles/pkg/js/v1/with-pnpm.mk
-include .makefiles/pkg/js/v1/with-tsc.mk

.makefiles/%:
	@curl -sfL https://makefiles.dev/v1 | bash /dev/stdin "$@"

################################################################################

.PHONY: precommit
precommit:: verify-generated

################################################################################

dist/aws-lambda/dist/index.mjs dist/aws-lambda/dist/index.mjs.map: script/build-aws-lambda.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/azure-function/dist/index.mjs dist/azure-function/dist/index.mjs.map: script/build-azure-function.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/cloudflare-worker/dist/index.js dist/cloudflare-worker/dist/index.js.map: script/build-cloudflare-worker.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/gcp-cloud-run/dist/index.mjs dist/gcp-cloud-run/dist/index.mjs.map: script/build-gcp-cloud-run.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"
