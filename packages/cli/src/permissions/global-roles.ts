import type { Scope } from '@n8n/permissions';

export const GLOBAL_OWNER_SCOPES: Scope[] = [
	'annotationTag:create',
	'annotationTag:read',
	'annotationTag:update',
	'annotationTag:delete',
	'annotationTag:list',
	'auditLogs:manage',
	'banner:dismiss',
	'credential:create',
	'credential:read',
	'credential:update',
	'credential:delete',
	'credential:list',
	'credential:share',
	'credential:move',
	'communityPackage:install',
	'communityPackage:uninstall',
	'communityPackage:update',
	'communityPackage:list',
	'eventBusDestination:create',
	'eventBusDestination:read',
	'eventBusDestination:update',
	'eventBusDestination:delete',
	'eventBusDestination:list',
	'eventBusDestination:test',
	'externalSecretsProvider:create',
	'externalSecretsProvider:read',
	'externalSecretsProvider:update',
	'externalSecretsProvider:delete',
	'externalSecretsProvider:list',
	'externalSecretsProvider:sync',
	'externalSecret:list',
	'externalSecret:use',
	'ldap:manage',
	'ldap:sync',
	'license:manage',
	'logStreaming:manage',
	'orchestration:read',
	'orchestration:list',
	'saml:manage',
	'securityAudit:generate',
	'sourceControl:pull',
	'sourceControl:push',
	'sourceControl:manage',
	'tag:create',
	'tag:read',
	'tag:update',
	'tag:delete',
	'tag:list',
	'user:create',
	'user:read',
	'user:update',
	'user:delete',
	'user:list',
	'user:resetPassword',
	'user:changeRole',
	'variable:create',
	'variable:read',
	'variable:update',
	'variable:delete',
	'variable:list',
	'workflow:create',
	'workflow:read',
	'workflow:update',
	'workflow:delete',
	'workflow:list',
	'workflow:share',
	'workflow:execute',
	'workflow:move',
	'workersView:manage',
	'project:list',
	'project:create',
	'project:read',
	'project:update',
	'project:delete',
];

export const GLOBAL_ADMIN_SCOPES = GLOBAL_OWNER_SCOPES.concat();

export const GLOBAL_MEMBER_SCOPES: Scope[] = [
	'annotationTag:create',
	'annotationTag:read',
	'annotationTag:update',
	'annotationTag:delete',
	'annotationTag:list',
	'eventBusDestination:list',
	'eventBusDestination:test',
	'tag:create',
	'tag:read',
	'tag:update',
	'tag:list',
	'user:list',
	'variable:list',
	'variable:read',
];
