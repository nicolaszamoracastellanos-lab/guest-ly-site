// Lets node load app modules that import their siblings without an extension
// ("./live", as Metro and tsc resolve them): a relative specifier that does
// not resolve as written is tried again with ".ts". Import this first, then
// load the module under test with a dynamic import().
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (e) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw e;
    }
  },
});
