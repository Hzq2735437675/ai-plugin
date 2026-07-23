import type { ReactNode } from 'react';

export type ModuleRoute = {
  name: string;
  path: string;
  element: ReactNode;
};

export type ModuleMenu = {
  key: string;
  label: string;
  path: string;
};

export type ModuleManifest = {
  name: string;
  version: string;
  domain: string;
  routes: readonly ModuleRoute[];
  menus: readonly ModuleMenu[];
  access: readonly string[];
  locales: readonly string[];
  stores: readonly string[];
  directives: readonly string[];
  dependencies: {
    shared: readonly string[];
    base_components: readonly string[];
    npm: readonly string[];
    dev: readonly string[];
    env: readonly string[];
    assets: readonly string[];
    permissions: readonly string[];
  };
};
