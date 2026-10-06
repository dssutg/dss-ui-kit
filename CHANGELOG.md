# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release notes are generated
from [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) by `scripts/release.ts`.

[0.2.0] — 2026-10-04

### Features

- **util:** add compareVersions for dotted version numbers ([a1c1606](https://github.com/dssutg/dss-ui-kit/commit/a1c160602c5b943c05a4c9bf3d2d2a913618cff5))
- **display:** add a LightRayOverlay drawn with an image the caller bundles ([4625b59](https://github.com/dssutg/dss-ui-kit/commit/4625b59c8defbbd868eef89852f81eac15b4d329))
- **feedback:** add a CommandConsole for caller-registered commands ([236f6b2](https://github.com/dssutg/dss-ui-kit/commit/236f6b2df788c02fa04aa259d06b338d6a97074f))
- **ui:** add a ConfirmationModal for a question with two answers ([19bdbc7](https://github.com/dssutg/dss-ui-kit/commit/19bdbc7d1270724550641c44f4fa704ad37c6e88))
- **navigation:** add a SlideMenu, a NavBar and the drag hook behind them ([004411f](https://github.com/dssutg/dss-ui-kit/commit/004411fa3523b12f8239d4951f553fdc19eb175f))
- **routing:** add slash-separated path helpers and a RouteSwitch ([5c1c6e5](https://github.com/dssutg/dss-ui-kit/commit/5c1c6e5e6930c591b08995c27d9c5854c6c6108f))
- **ui:** add render tests per group and publish the tailwind token preset ([8c27791](https://github.com/dssutg/dss-ui-kit/commit/8c27791355e7d7d57300750820815dc40419d49a))
- **ui:** publish the components that were built but not exported ([ee7506a](https://github.com/dssutg/dss-ui-kit/commit/ee7506acf6d992f2c1446d96785a95f7e0b00c64))
- **gl:** keep the WebGL scene renderer as a generic library module ([0e58df7](https://github.com/dssutg/dss-ui-kit/commit/0e58df743a154e7a1944d4025a72e728ac132c96))
- **locale:** let any language be added, not only the two shipped ([fe800e0](https://github.com/dssutg/dss-ui-kit/commit/fe800e0f9e7597e6f826be6f7120c324d99922ba))
- **ui:** export the colour pickers ([3e1b25c](https://github.com/dssutg/dss-ui-kit/commit/3e1b25cf35b380218ecce948914fb8948a9cb62a))
- add the public surface and the guards that keep it decoupled ([da1046a](https://github.com/dssutg/dss-ui-kit/commit/da1046a81ad88bdcef22c6d671fd4c15d0c00c8a))
- initial commit ([94c539c](https://github.com/dssutg/dss-ui-kit/commit/94c539c5f5a6909e861ee1cc83a1ced8003613da))

### Bug Fixes

- type the timeout handles as whatever setTimeout returns ([383c930](https://github.com/dssutg/dss-ui-kit/commit/383c930779deaf21e781844455e94717d2d165da))
- **config:** drop the comment that was making every lint override a no-op ([e6e5d1f](https://github.com/dssutg/dss-ui-kit/commit/e6e5d1ff2520d6df881867b54524cb2c439be244))
- **types:** make the copied source pass strict typecheck ([e568d11](https://github.com/dssutg/dss-ui-kit/commit/e568d1175a5103af2b267a3844e82d4a242adec9))
- **locale:** cut the catalogues to the keys the library renders and admit explicit undefined ([57d0b45](https://github.com/dssutg/dss-ui-kit/commit/57d0b4577b43c855a2350bb1d19e25a30c59707d))

### Refactoring

- **inputs:** guard SearchInput's clear-button classes with && instead of an empty string ([6d7c94f](https://github.com/dssutg/dss-ui-kit/commit/6d7c94fb1b96dd113efa8e25b022cac16613bd8f))
- **ui:** drop the stray justify-content token and spell cn() guards with && ([27e2e80](https://github.com/dssutg/dss-ui-kit/commit/27e2e804edd219127563d4bb140c277e5263c766))
- **ui:** build every component class list with cn() instead of interpolation ([282232c](https://github.com/dssutg/dss-ui-kit/commit/282232c0feb136a3a978b23c6d4369433a4373c1))
- **styles:** group src/css into themes/ and components/ and drop the theme_ prefix ([44313e6](https://github.com/dssutg/dss-ui-kit/commit/44313e688d891ec29de45b119c5381339edad32f))
- **lib:** rename src/lib and scripts/lib to util ([8c88d01](https://github.com/dssutg/dss-ui-kit/commit/8c88d0108ad6be820676ce375fbca15e939f9038))
- **lib:** group the flat src/lib helpers into one directory per group ([c1bb9d3](https://github.com/dssutg/dss-ui-kit/commit/c1bb9d3ceb856888764c391d7bbeb718dcc53418))
- **ui:** remove the last hardcoded address and the any-typed resize fallback ([18403aa](https://github.com/dssutg/dss-ui-kit/commit/18403aa022d55b2bb9538a335180d790ff10ee23))
- **components:** name each module after what it exports ([30174ef](https://github.com/dssutg/dss-ui-kit/commit/30174ef0a8f1bf0499d63a8f53f1b11aa19ddead))
- **components:** group components into directories and move the icons out ([4ccc1ad](https://github.com/dssutg/dss-ui-kit/commit/4ccc1ad463e6b4a1053f21f5cd42d689e31bd24a))
- remove the rack visualisation from the library ([6f2bc5b](https://github.com/dssutg/dss-ui-kit/commit/6f2bc5b20c42425cb793c8775dc78075f3261f30))
- bring every function under the complexity limit ([0fa9843](https://github.com/dssutg/dss-ui-kit/commit/0fa9843caa5c4f33b261563aaa883278e5c48218))
- split the rack renderer and the editor ([dcb3b4a](https://github.com/dssutg/dss-ui-kit/commit/dcb3b4ac83dfe61b78082d5f8448e335b2afb58f))
- split the maths and DOM helpers by subject ([227af53](https://github.com/dssutg/dss-ui-kit/commit/227af53033f3b78610ac9ad36e16576a78ae8765))
- split multi-component modules into one PascalCase file per component ([7e5b11c](https://github.com/dssutg/dss-ui-kit/commit/7e5b11c9dea5da7f95aeb122886e5f105b1c8379))
- rename single-component modules to PascalCase ([ec2bc09](https://github.com/dssutg/dss-ui-kit/commit/ec2bc09cfa11e3ef042171d5031bcb1dfbfebf75))
- split the autosizer measurement and the picker's touch handling ([29c2690](https://github.com/dssutg/dss-ui-kit/commit/29c26901673b27242715c69ec83921f253166af1))
- split the functions that were doing more than one job ([67975cf](https://github.com/dssutg/dss-ui-kit/commit/67975cf0199a602a661fb3e79b49367e6f4d1885))
- clear the mechanical lint rules that hid real decisions ([eaf0972](https://github.com/dssutg/dss-ui-kit/commit/eaf09726fb682bd64324db4e82515f72a3c77f2c))
- **ui:** make every interactive element a real control ([2f1ace5](https://github.com/dssutg/dss-ui-kit/commit/2f1ace50750e608b2542fe5187b6dfb4afe6a74e))
- **color_picker:** clear the last non-null assertions in the library ([e34507b](https://github.com/dssutg/dss-ui-kit/commit/e34507baf5c206babcc8dcee6fde1582b94d19e7))
- **ui:** read through checked accessors in Calendar and FilterableTable ([1522d15](https://github.com/dssutg/dss-ui-kit/commit/1522d157a78c2b73b2a7c66b0115114a6225c1a7))
- **ui:** remove 38 more assertions, and fix a crash they were hiding in Tree ([c08f6b3](https://github.com/dssutg/dss-ui-kit/commit/c08f6b37142b90ca5b088f63a719f3fb311b8288))
- **dsv:** rebuild parseCSV around committed fields instead of a sparse grid ([1924a98](https://github.com/dssutg/dss-ui-kit/commit/1924a989603778fbfa7a98989ff50b5e21138e5d))
- **dom:** read touch positions through one checked helper instead of nine assertions ([7aacbb3](https://github.com/dssutg/dss-ui-kit/commit/7aacbb35829fb75eb66bb5ad36b23aae62c106c2))
- **lib/math:** type the matrices so the indices need no assertions ([48495ea](https://github.com/dssutg/dss-ui-kit/commit/48495eaf58a41c0c0954d9275d16845d1080c335))
- **lib/array:** remove every non-null assertion from the array helpers ([9e95bed](https://github.com/dssutg/dss-ui-kit/commit/9e95bed9000bbf9b82df10fdb65293d6db6edfb6))
- **server-rack:** make the rack renderer and device-database editor caller-driven ([9508aac](https://github.com/dssutg/dss-ui-kit/commit/9508aac51346aa8c64449ed1f9c67a1dc3c7899a))
- **lib:** strip application coupling and cut the message set to what the library renders ([f34f1fb](https://github.com/dssutg/dss-ui-kit/commit/f34f1fbcef67828e248529ea68cc158c1893f881))

### Documentation

- require reporting anything that looks like a bug, not just what a task asked about ([308ca6f](https://github.com/dssutg/dss-ui-kit/commit/308ca6f93483cc10013e6dee52187f7983faf1c1))
- **ui:** add TSDoc to the remaining undocumented source files ([d2f4bb8](https://github.com/dssutg/dss-ui-kit/commit/d2f4bb8a408671f63834f4701c5d71d4fa98b6e1))
- drop work-in-progress state and volatile numbers from the documentation ([0f1e687](https://github.com/dssutg/dss-ui-kit/commit/0f1e687eaca8f5c8fcf6142777053f4f6bae7548))
- correct the helper module count in TODO.md ([0f3208e](https://github.com/dssutg/dss-ui-kit/commit/0f3208e4c4f3660e83054fdd4ff22e84bbfe33f8))
- **lib:** document the rest of the public surface ([53e833f](https://github.com/dssutg/dss-ui-kit/commit/53e833f7b2f7433ac35e510f28890cff01b088b1))
- **charts,layout,tables:** document the remaining component groups ([9ab7edf](https://github.com/dssutg/dss-ui-kit/commit/9ab7edfeb523677e22172cd560178b094c0bf4b7))
- **navigation,color-picker:** document both groups ([bff3341](https://github.com/dssutg/dss-ui-kit/commit/bff33414318cc0543d76ebb4cc01ee403c0d7f8c))
- **inputs:** document every exported input ([f47637c](https://github.com/dssutg/dss-ui-kit/commit/f47637ce18ca362224cbbe72fa7c025769ab8d5b))
- **ui:** document the infrastructure, buttons, display, feedback and overlay surfaces ([975ad72](https://github.com/dssutg/dss-ui-kit/commit/975ad72d8e8879c035726ea2bba1fb4d149751f7))
- rewrite the three markdown documents against the library as it stands ([d0e835c](https://github.com/dssutg/dss-ui-kit/commit/d0e835cd12f61f31dfe0829b33bf4e825ec9cd59))
- generate the API reference from the public surface only ([e44ae1f](https://github.com/dssutg/dss-ui-kit/commit/e44ae1fb57b8000d8590db6c5976a7ec2f1302e2))
- drop every mention of the code base this library came from ([654193d](https://github.com/dssutg/dss-ui-kit/commit/654193d17465c347681fec23875161fc2380be76))
- tick the stages that are done ([a94b948](https://github.com/dssutg/dss-ui-kit/commit/a94b9488404d1cb558bc93891241791365aacaa5))
- export the types the public signatures already refer to ([af9bbfd](https://github.com/dssutg/dss-ui-kit/commit/af9bbfd53d4594e4f128939bcdef8c6f1ba0297f))
- record the fourth relaxed rule in the two places that name them ([36bc8f3](https://github.com/dssutg/dss-ui-kit/commit/36bc8f3927e85f1f14e8ac8d7363368df3c056e3))
- add the decoupling plan and the repository constitution ([8a7f3cd](https://github.com/dssutg/dss-ui-kit/commit/8a7f3cd6fb776aed93e91294748d50bb5add7a05))

### Tests

- **util:** type the new suites against the library's own strictness ([e4f28d6](https://github.com/dssutg/dss-ui-kit/commit/e4f28d68973e8cf33983d14b382e024a9fe37dc9))
- **util:** fix lint findings in the new hook tests ([b696fda](https://github.com/dssutg/dss-ui-kit/commit/b696fda3711c69db034140e62948a0cea113122c))
- **util:** cover the color helpers ([d4ed89c](https://github.com/dssutg/dss-ui-kit/commit/d4ed89ca6d575d0f3f80a8bd0dce593084947453))
- **util:** cover the hooks and the editor keybindings ([b742e51](https://github.com/dssutg/dss-ui-kit/commit/b742e510cde22eba1da1784e4c54dba75237fd07))
- **util:** cover the editor modules and the WebGL geometry ([6c80f28](https://github.com/dssutg/dss-ui-kit/commit/6c80f28d6c7d98d6ce2bb39dc170ebade45f898f))
- **util:** cover the util groups the suite had not reached ([123acd0](https://github.com/dssutg/dss-ui-kit/commit/123acd031316111d1ddd7a134dfcc369dd07e9b9))

### Build

- name the globals the UMD build reads off `window` ([8f3e6e1](https://github.com/dssutg/dss-ui-kit/commit/8f3e6e1c6c60893e78dd1e5d30745c7585d9791b))
- **css:** compile Tailwind instead of shipping a checked-in build ([1a052c8](https://github.com/dssutg/dss-ui-kit/commit/1a052c863eed07d229e87fceb82ef89d7bfa09b7))
- **config:** set up the library toolchain and repository scaffolding ([4ffc14f](https://github.com/dssutg/dss-ui-kit/commit/4ffc14fd085bda531ffb73bfeb713dc7d3f6f06a))

### Continuous Integration

- install frozen dependencies in every job ([6a61d2a](https://github.com/dssutg/dss-ui-kit/commit/6a61d2adc10ac471ffdbf539281071e9a518e975))
- replace the GitLab pipeline with GitHub Actions ([9189e1f](https://github.com/dssutg/dss-ui-kit/commit/9189e1f16116910256dedca55119a31e8e33044d))

### Styling

- **date:** spell the step list as a readonly array type ([fe4155a](https://github.com/dssutg/dss-ui-kit/commit/fe4155a5b10d2008f19cd83191fc428e79e1b9ab))

### Chores

- **release:** 0.2.0 ([ff73722](https://github.com/dssutg/dss-ui-kit/commit/ff7372254d393a619022be890060bec21f758518))
- remove TODO.md now that the publication-preparation work is done ([f598293](https://github.com/dssutg/dss-ui-kit/commit/f598293c377b2c7599f4e257cf4786b7afd312b9))
- **config:** turn off useComponentExportOnlyModules, and record why ([2beeddd](https://github.com/dssutg/dss-ui-kit/commit/2beeddd87af6e82a593901a5daa9f220255b8b39))

**Contributors:** Daniil Stepanov

[0.3.0] — 2026-10-05

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.2.0...v0.3.0)

### Features

- **icons:** let a caller register and replace icons ([617ca98](https://github.com/dssutg/dss-ui-kit/commit/617ca98e0d97fe186bc10a99b990a3dcc051baf5))
- **components:** add className to every component and merge it over the caller's own ([144d8cc](https://github.com/dssutg/dss-ui-kit/commit/144d8ccf7b08e6f1b150562025a46888868ea356))
- **config:** publish the TypeScript source to JSR as @dssutg/dss-ui-kit ([521a552](https://github.com/dssutg/dss-ui-kit/commit/521a552017777e27f4aebc7a1c3ab9797024b3e9))

### Bug Fixes

- **release:** strip the access token embedded in the remote url from changelog links ([871b969](https://github.com/dssutg/dss-ui-kit/commit/871b969e4d9ab1bea4b2db2e87dca0165d3d7f6c))
- **locale:** document that t returns an unknown key, as translate already did ([496ce41](https://github.com/dssutg/dss-ui-kit/commit/496ce41cb9b84a21e836c75ceebe9d1ecaefa998))
- **locale:** merge a repeated registration over the one already registered ([36a0c74](https://github.com/dssutg/dss-ui-kit/commit/36a0c74f2f06a111483dbfa070973dd20b062708))
- **components:** render the crash guard's own fallback and give RouteSwitch a className ([36124dd](https://github.com/dssutg/dss-ui-kit/commit/36124dd17090d9409323c43e5eafdb8ffa1797ca))
- **locale:** merge a caller's messages over the shipped ones per message ([9ae5056](https://github.com/dssutg/dss-ui-kit/commit/9ae50569ca5542d8bdaa589f585fcac2f4054016))
- **publish:** give every exported symbol an explicit type so the publish runs without slow types allowed ([adadd17](https://github.com/dssutg/dss-ui-kit/commit/adadd17a27956ba4759daad0ffcd0fe9c994c9c8))
- **ci:** check out the repository before referencing the local setup action ([0557160](https://github.com/dssutg/dss-ui-kit/commit/055716008eb26662740d267e4e4b8348531c1344))

### Chores

- **release:** 0.3.0 ([65990b6](https://github.com/dssutg/dss-ui-kit/commit/65990b675ffa6890bb6f1722a01b76c34553c69d))

**Contributors:** Daniil Stepanov

[0.4.0] — 2026-10-05

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.3.0...v0.4.0)

### Features

- **icons:** bundle the source SVGs into src/icons/index.tsx with deno task icons ([53a1418](https://github.com/dssutg/dss-ui-kit/commit/53a1418b443067f9cf0361466db3ebf5cbaedd78))

### Chores

- **release:** 0.4.0 ([6c2af72](https://github.com/dssutg/dss-ui-kit/commit/6c2af7294843b41f6a950c2d27e82c6849a5299a))
- **ci:** remove JSR publish step ([b28673d](https://github.com/dssutg/dss-ui-kit/commit/b28673db25e9974540d33cffe88ef41ee2e40856))

**Contributors:** Daniil Stepanov

[0.5.0] — 2026-10-06

[Full changelog](https://github.com/dssutg/dss-ui-kit/compare/v0.4.0...v0.5.0)

### Features

- **styles:** ship the hand-written blink, scale-show and popup animations ([98260ba](https://github.com/dssutg/dss-ui-kit/commit/98260baacdb1b2a5cef44e0e9aca91c037ed5e35))

### Bug Fixes

- **ui:** export RouteSwitchProps ([703fe0f](https://github.com/dssutg/dss-ui-kit/commit/703fe0f2a35d4da8c7f985fb5262a8fe6544f3fa))
- **styles:** declare the fade-in and wsh-spinner animations the preset never carried ([1a78a94](https://github.com/dssutg/dss-ui-kit/commit/1a78a94336a1fa5c02af88c9c3224f8482cc3abb))
- **styles:** declare the ripple animation the preset never carried ([027de3c](https://github.com/dssutg/dss-ui-kit/commit/027de3c87f5baab203e5495d4aa569000921f3e7))

### Documentation

- prefer semantic tools over raw text search-and-replace ([46f17ff](https://github.com/dssutg/dss-ui-kit/commit/46f17ff4851311300a1e82150b6abbf86bb871da))
- refresh README command list and add a table of contents ([70567fe](https://github.com/dssutg/dss-ui-kit/commit/70567fe21730b6e8645812d49606f5010bde3961))
- add code re-use rule to the readability section ([5b6b0b9](https://github.com/dssutg/dss-ui-kit/commit/5b6b0b9c6a6b86fc290e3820eab4a77a28fc243f))
- require only needed words in comments and commit messages ([130d0fd](https://github.com/dssutg/dss-ui-kit/commit/130d0fdbc7f677159ad182dfbca057f05fa6fe95))

### Build

- **config:** add ast-grep, codemod and markdownlint-cli2 tooling ([c07d6fa](https://github.com/dssutg/dss-ui-kit/commit/c07d6face71ede5fae161915ecf74ce14ac7b5d7))

### Chores

- **release:** 0.5.0 ([167cd32](https://github.com/dssutg/dss-ui-kit/commit/167cd32a734a10dcd4ee59bd0f4e695dd070d01c))
- **config:** ignore the RepoMapper tag cache directory ([25e8244](https://github.com/dssutg/dss-ui-kit/commit/25e824493196b31f1fde7491807d46d6305b9e20))

**Contributors:** Daniil Stepanov
