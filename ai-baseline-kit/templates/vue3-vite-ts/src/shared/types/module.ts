import type { Component } from 'vue';

export type ModuleRoute = {
  name: string;
  path: string;
  component: Component;
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
  routes: ModuleRoute[];
  menus: ModuleMenu[];
  access: string[];
  locales: string[];
  stores: string[];
  directives: string[];
  dependencies: {
    shared: string[];
    base_components: string[];
    npm: string[];
    env: string[];
    assets: string[];
    permissions: string[];
  };
};
