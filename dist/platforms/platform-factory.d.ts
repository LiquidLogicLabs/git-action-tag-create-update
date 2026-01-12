import { RepoType, RepositoryInfo, PlatformAPI } from '../types';
import { Logger } from '../logger';
export declare function createPlatformAPI(repoInfo: RepositoryInfo, repoType: RepoType, config: {
    token?: string;
    baseUrl?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
    pushTag?: boolean;
}, logger: Logger): Promise<{
    platform: RepoType;
    api: PlatformAPI;
    baseUrl?: string;
}>;
//# sourceMappingURL=platform-factory.d.ts.map