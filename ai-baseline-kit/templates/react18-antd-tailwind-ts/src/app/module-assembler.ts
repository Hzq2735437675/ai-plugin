// ai-baseline:module-imports:start
import { moduleManifest as homeModule } from '@/modules/home';
// ai-baseline:module-imports:end

export const modules = [
  // ai-baseline:module-list:start
  homeModule,
  // ai-baseline:module-list:end
] as const;
