import type { AuthState } from '../types/index.js'

/** Community builds do not implement enterprise identity authentication. */
export class AuthService {
  public getAuthState(): AuthState { return { isAuthenticated: false, user: null } }
  public async loginWithProvider(_provider?: string): Promise<{ success: boolean; error: string }> {
    return { success: false, error: 'SSO 尚未实现；请使用 Harness 服务自身的认证方式。' }
  }
  public logout(): void {}
}
