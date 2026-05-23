GENERATED_FILES += dist/aws-lambda/dist/index.mjs dist/aws-lambda/dist/index.mjs.map
GENERATED_FILES += dist/azure-function/dist/index.mjs dist/azure-function/dist/index.mjs.map
GENERATED_FILES += dist/cloudflare-worker/dist/index.js dist/cloudflare-worker/dist/index.js.map
GENERATED_FILES += dist/gcp-cloud-run/dist/index.mjs dist/gcp-cloud-run/dist/index.mjs.map

JS_ESLINT_REQ += dist/cloudflare-worker/worker-configuration.d.ts

-include .makefiles/Makefile
-include .makefiles/pkg/js/v1/Makefile
-include .makefiles/pkg/js/v1/with-pnpm.mk

.makefiles/%:
	@curl -sfL https://makefiles.dev/v1 | bash /dev/stdin "$@"

################################################################################

.PHONY: tsc-typecheck
tsc-typecheck: artifacts/link-dependencies.touch dist/cloudflare-worker/worker-configuration.d.ts
	$(JS_EXEC) tsc -b

.PHONY: ci
ci:: tsc-typecheck

.PHONY: lint
lint:: tsc-typecheck

.PHONY: precommit
precommit:: tsc-typecheck verify-generated

.PHONY: release
release: artifacts/release/azure-function.zip

################################################################################

dist/aws-lambda/dist/index.mjs dist/aws-lambda/dist/index.mjs.map: script/build-aws-lambda.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/azure-function/dist/index.mjs dist/azure-function/dist/index.mjs.map: script/build-azure-function.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/cloudflare-worker/worker-configuration.d.ts: dist/cloudflare-worker/wrangler.toml artifacts/link-dependencies.touch
	$(JS_EXEC) wrangler types --config $< --strict-vars=false $@

dist/cloudflare-worker/dist/index.js dist/cloudflare-worker/dist/index.js.map: script/build-cloudflare-worker.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

dist/gcp-cloud-run/dist/index.mjs dist/gcp-cloud-run/dist/index.mjs.map: script/build-gcp-cloud-run.ts artifacts/link-dependencies.touch $(JS_SOURCE_FILES)
	node "$<" "$@"

################################################################################

artifacts/release/azure-function.zip: dist/azure-function/dist/index.mjs dist/azure-function/host.json dist/azure-function/package.json dist/azure-function/package-lock.json
	@mkdir -p "$(@D)"
	cd dist/azure-function && zip -FSr ../../$@ . -x 'azuredeploy.json' 'README.md'
