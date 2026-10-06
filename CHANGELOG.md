# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release notes are generated
from [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) by `scripts/release.ts`.

[0.5.1] — 2026-10-06

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.5.0...v0.5.1)

### Bug Fixes

- **styles:** resolve the notification date through --color-gray-light4 ([63100f4](https://github.com/dssutg/dss-ui-kit/commit/63100f4ea1384a49eb0e9927df2cce74d38a8f7d))
- **locale:** let t resolve the caller's own keys too ([009834a](https://github.com/dssutg/dss-ui-kit/commit/009834a528e8efa5641b27b293875e2ffe01136a))
- **styles:** stop the forms plugin from drawing a blue focus ring ([a77b313](https://github.com/dssutg/dss-ui-kit/commit/a77b31309efba1c6e7f0e34575e590dffbf27c44))

**Contributors:** Daniil Stepanov

[0.5.0] — 2026-10-06

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.4.0...v0.5.0)

### Features

- **styles:** ship the hand-written blink, scale-show and popup animations ([7444b31](https://github.com/dssutg/dss-ui-kit/commit/7444b31ba19df1a05058aac90ef6e59ed60a74f7))

### Bug Fixes

- **ui:** export RouteSwitchProps ([854dae7](https://github.com/dssutg/dss-ui-kit/commit/854dae7395fc884c6a019e87cf9e971fbf8d524d))
- **styles:** declare the fade-in and wsh-spinner animations the preset never carried ([8ece5f8](https://github.com/dssutg/dss-ui-kit/commit/8ece5f8b6265bbc619bc22edadaedd8c9f412991))
- **styles:** declare the ripple animation the preset never carried ([da564f7](https://github.com/dssutg/dss-ui-kit/commit/da564f703cb2c40c67b244acc66b95eea39b8cac))

### Documentation

- prefer semantic tools over raw text search-and-replace ([eb65561](https://github.com/dssutg/dss-ui-kit/commit/eb65561610754659f26a468349068a5647cdb7e7))
- refresh README command list and add a table of contents ([b59f503](https://github.com/dssutg/dss-ui-kit/commit/b59f50343ba0a0c2e15711a63ace8f490cc52361))
- add code re-use rule to the readability section ([6bfa6f1](https://github.com/dssutg/dss-ui-kit/commit/6bfa6f11d3501444e390d266ec44d05fea68e0fd))
- require only needed words in comments and commit messages ([e020dac](https://github.com/dssutg/dss-ui-kit/commit/e020dac811eaec0eb4aed896f7e25e25786b791c))

### Build

- **config:** add ast-grep, codemod and markdownlint-cli2 tooling ([bbaca4c](https://github.com/dssutg/dss-ui-kit/commit/bbaca4c655f4b64db5648dde33105ac94cf65da5))

### Chores

- **config:** ignore the RepoMapper tag cache directory ([7b45030](https://github.com/dssutg/dss-ui-kit/commit/7b450306b9fa6a29bee49dc2b113f2e9e8568ad4))

**Contributors:** Daniil Stepanov

[0.4.0] — 2026-10-05

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.3.0...v0.4.0)

### Features

- **icons:** bundle the source SVGs into src/icons/index.tsx with deno task icons ([4ed33a0](https://github.com/dssutg/dss-ui-kit/commit/4ed33a0197e961c7533e2ddc8c1c35d0f581cacd))

### Chores

- **ci:** remove JSR publish step ([be9d79e](https://github.com/dssutg/dss-ui-kit/commit/be9d79e64e154c62395f85c69dc69974b2536e6b))

**Contributors:** Daniil Stepanov

[0.3.0] — 2026-10-05

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.2.0...v0.3.0)

### Features

- **icons:** let a caller register and replace icons ([08feb55](https://github.com/dssutg/dss-ui-kit/commit/08feb55682a9af48c60edc4bb3fcf1b037b190ed))
- **components:** add className to every component and merge it over the caller's own ([e1fd170](https://github.com/dssutg/dss-ui-kit/commit/e1fd17003ccb653614a83b49c890fd2addaaf19c))
- **config:** publish the TypeScript source to JSR as @dssutg/dss-ui-kit ([ea6f897](https://github.com/dssutg/dss-ui-kit/commit/ea6f8974e1069cdbb99657c474737ee1cf52dac1))

### Bug Fixes

- **release:** strip the access token embedded in the remote url from changelog links ([f10d117](https://github.com/dssutg/dss-ui-kit/commit/f10d11787cd1f2d7eb3880d11d6a28636cb91e85))
- **locale:** document that t returns an unknown key, as translate already did ([8f8da09](https://github.com/dssutg/dss-ui-kit/commit/8f8da092d1d7bc4692ff0210dbdb1ea151f293bc))
- **locale:** merge a repeated registration over the one already registered ([e481d01](https://github.com/dssutg/dss-ui-kit/commit/e481d018b26fba1a07ce1f076cdf434919b959a7))
- **components:** render the crash guard's own fallback and give RouteSwitch a className ([bf3176d](https://github.com/dssutg/dss-ui-kit/commit/bf3176d9ba6f4a0ded6133fea72f6e833288790c))
- **locale:** merge a caller's messages over the shipped ones per message ([05036e3](https://github.com/dssutg/dss-ui-kit/commit/05036e3902a4a6e865bbf862d736f14c71888981))
- **publish:** give every exported symbol an explicit type so the publish runs without slow types allowed ([98c5c64](https://github.com/dssutg/dss-ui-kit/commit/98c5c648c719a7f32d47b6b7e840836a85867757))
- **ci:** check out the repository before referencing the local setup action ([61cc679](https://github.com/dssutg/dss-ui-kit/commit/61cc679260039806d88c38690185c59e96d0a7f3))

**Contributors:** Daniil Stepanov

[0.2.0] — 2026-10-04

### Features

- **util:** add compareVersions for dotted version numbers (cc4c22e)
- **display:** add a LightRayOverlay drawn with an image the caller bundles (151eac5)
- **feedback:** add a CommandConsole for caller-registered commands (ea49024)
- **ui:** add a ConfirmationModal for a question with two answers (eae0cf7)
- **navigation:** add a SlideMenu, a NavBar and the drag hook behind them (fee5ae4)
- **routing:** add slash-separated path helpers and a RouteSwitch (3757d3d)
- **ui:** add render tests per group and publish the tailwind token preset (90a43a8)
- **ui:** publish the components that were built but not exported (b208b6b)
- **gl:** keep the WebGL scene renderer as a generic library module (12e642d)
- **locale:** let any language be added, not only the two shipped (625a8e7)
- **ui:** export the colour pickers (9038e64)
- add the public surface and the guards that keep it decoupled (6d0c071)
- initial commit (1777460)

### Bug Fixes

- type the timeout handles as whatever setTimeout returns (89e6ddf)
- **config:** drop the comment that was making every lint override a no-op (9e083a8)
- **types:** make the copied source pass strict typecheck (8a4e8dd)
- **locale:** cut the catalogues to the keys the library renders and admit explicit undefined (f5a339c)

### Refactoring

- **inputs:** guard SearchInput's clear-button classes with && instead of an empty string (f375f1e)
- **ui:** drop the stray justify-content token and spell cn() guards with && (c2bd575)
- **ui:** build every component class list with cn() instead of interpolation (49ee8fa)
- **styles:** group src/css into themes/ and components/ and drop the theme_ prefix (614724a)
- **lib:** rename src/lib and scripts/lib to util (d41e2a8)
- **lib:** group the flat src/lib helpers into one directory per group (d4f0506)
- **ui:** remove the last hardcoded address and the any-typed resize fallback (bbeb273)
- **components:** name each module after what it exports (af9f6be)
- **components:** group components into directories and move the icons out (5d01712)
- remove the rack visualisation from the library (e143cec)
- bring every function under the complexity limit (0a3b260)
- split the rack renderer and the editor (80bb37a)
- split the maths and DOM helpers by subject (3b80bba)
- split multi-component modules into one PascalCase file per component (f3cf89f)
- rename single-component modules to PascalCase (a5782fb)
- split the autosizer measurement and the picker's touch handling (354cd8f)
- split the functions that were doing more than one job (14dd199)
- clear the mechanical lint rules that hid real decisions (eafad07)
- **ui:** make every interactive element a real control (537335e)
- **color_picker:** clear the last non-null assertions in the library (783d822)
- **ui:** read through checked accessors in Calendar and FilterableTable (f6e5277)
- **ui:** remove 38 more assertions, and fix a crash they were hiding in Tree (cf760c3)
- **dsv:** rebuild parseCSV around committed fields instead of a sparse grid (0648c7c)
- **dom:** read touch positions through one checked helper instead of nine assertions (04dea2a)
- **lib/math:** type the matrices so the indices need no assertions (edb4acf)
- **lib/array:** remove every non-null assertion from the array helpers (84324fd)
- **server-rack:** make the rack renderer and device-database editor caller-driven (bf0bfb7)
- **lib:** strip application coupling and cut the message set to what the library renders (549b9bf)

### Documentation

- require reporting anything that looks like a bug, not just what a task asked about (e6864d8)
- **ui:** add TSDoc to the remaining undocumented source files (cfbb0ea)
- drop work-in-progress state and volatile numbers from the documentation (e5d7528)
- correct the helper module count in TODO.md (7bffe76)
- **lib:** document the rest of the public surface (8317897)
- **charts,layout,tables:** document the remaining component groups (09c0a21)
- **navigation,color-picker:** document both groups (36cff43)
- **inputs:** document every exported input (4ea7644)
- **ui:** document the infrastructure, buttons, display, feedback and overlay surfaces (583cc0e)
- rewrite the three markdown documents against the library as it stands (b1157b8)
- generate the API reference from the public surface only (c9be90f)
- drop every mention of the code base this library came from (9bc8c82)
- tick the stages that are done (ef6fc0b)
- export the types the public signatures already refer to (59726ef)
- record the fourth relaxed rule in the two places that name them (56b697f)
- add the decoupling plan and the repository constitution (55c1a3f)

### Tests

- **util:** type the new suites against the library's own strictness (c9acd60)
- **util:** fix lint findings in the new hook tests (9f66473)
- **util:** cover the color helpers (42e4206)
- **util:** cover the hooks and the editor keybindings (d7bddaf)
- **util:** cover the editor modules and the WebGL geometry (b7e9cdb)
- **util:** cover the util groups the suite had not reached (10cc86c)

### Build

- name the globals the UMD build reads off `window` (e85e5eb)
- **css:** compile Tailwind instead of shipping a checked-in build (5169cfd)
- **config:** set up the library toolchain and repository scaffolding (e276332)

### Continuous Integration

- install frozen dependencies in every job (84d6e72)
- replace the GitLab pipeline with GitHub Actions (ea9bef9)

### Styling

- **date:** spell the step list as a readonly array type (7d28e92)

### Chores

- remove TODO.md now that the publication-preparation work is done (3835072)
- **config:** turn off useComponentExportOnlyModules, and record why (14e9495)

**Contributors:** Daniil Stepanov
