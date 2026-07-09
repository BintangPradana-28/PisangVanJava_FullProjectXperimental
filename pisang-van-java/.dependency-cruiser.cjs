/**
 * Architecture boundary rules for Pisang Van Java.
 *
 * Every rule here maps to a REAL issue found during architecture audits of this
 * project — this file exists so those exact issues can't quietly reappear.
 * Run: `pnpm depcruise` (see package.json). Wired into CI (.github/workflows/ci.yml)
 * as a required check — a violation fails the build, it doesn't just warn.
 *
 * To see WHY a rule exists, read its `comment` field below before loosening it.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-client-component-prisma-import',
      severity: 'error',
      comment:
        "A 'use client' component must never import lib/prisma or @prisma/client directly. " +
        'This project has kept this boundary clean so far (verified manually during the ' +
        'architecture audit) — this rule makes sure a future change (human or AI-authored) ' +
        "can't quietly break it. If a client component needs data, it should call a Server " +
        'Action or fetch from a route handler, not touch Prisma itself.',
      from: {
        path: '^(components|src/features|src/components)/.*\\.tsx$',
        pathNot: '\\.(test|spec)\\.tsx$'
        // Scoped to .tsx specifically — this codebase's convention is that actual
        // React components are always .tsx, while Server Actions (actions.ts),
        // services (*.service.ts), and Inngest workflows (*.workflow.ts) are .ts.
        // An earlier version of this rule matched the whole components/src/features
        // tree regardless of extension and produced false positives on exactly
        // those files (e.g. src/features/checkout/actions.ts) — Server Actions are
        // server-only by Next.js's own 'use server' contract and are SUPPOSED to
        // import Prisma directly. dependency-cruiser can't read the 'use client'/
        // 'use server' directive itself, so the .tsx/.ts split is the closest
        // reliable proxy available for this codebase's actual conventions.
      },
      to: {
        path: '^(lib/prisma|node_modules/@prisma/client)'
      }
    },
    {
      name: 'no-cross-feature-internals',
      severity: 'error',
      comment:
        'src/features/X may not reach into src/features/Y internals (repositories, ' +
        'services, components, stores). It MAY import: (a) type-only exports from ' +
        "another feature (e.g. pos importing `import type { ProductType }` from menu), " +
        "or (b) a feature's actions.ts, which is this project's sanctioned Server Action " +
        "contract for cross-feature calls (e.g. cart calling checkout's validateVoucher). " +
        'Both of these existing, audited cases are allowlisted below — anything else ' +
        'reaching across a feature boundary is new and should be justified explicitly.',
      from: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/([^/]+)/actions\\.ts$'
      },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: [
          // allow importing your OWN feature's other files freely
          '^src/features/$1/',
          // allow the two sanctioned exceptions found during audit:
          '^src/features/menu/components/MenuCards\\.tsx$', // type-only export consumed by pos
          '^src/features/checkout/actions\\.ts$' // Server Action contract consumed by cart
        ]
      }
    },
    {
      name: 'no-new-files-in-legacy-src-app',
      severity: 'error',
      comment:
        "src/app/ is NOT read by Next.js App Router — only the top-level app/ is. " +
        "A dead duplicate webhook route (src/app/api/webhooks/midtrans/route.ts) lived " +
        "here for multiple audit cycles before being caught, because it silently did " +
        "nothing rather than erroring. This rule makes src/app/** a hard error so a new " +
        "file placed here (never reachable by any real request) fails fast instead of " +
        "sitting there looking functional.",
      from: {},
      to: {
        path: '^src/app/'
      }
    },
    {
      name: 'no-new-files-in-deprecated-src-components',
      severity: 'error',
      comment:
        'src/components/ used to hold a duplicate MapPicker implementation that quietly ' +
        'diverged from components/user/MapPicker.tsx (different default map center — one ' +
        'was wrong — different marker behavior) for an unknown number of audit cycles ' +
        'before being consolidated into components/shared/MapPicker.tsx. This folder is ' +
        'now deprecated: new shared UI components belong in components/shared/, ' +
        'user-storefront-only components in components/user/, admin-only in components/admin/.',
      from: {},
      to: {
        path: '^src/components/'
      }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'A file with zero importers anywhere in the project. This exact pattern is how ' +
        'src/lib/store/usePosStore.ts (a duplicate, outdated Zustand store — the real one ' +
        'lives at src/features/pos/store/usePosStore.ts) and src/lib/SearchDialog.tsx (a ' +
        'byte-identical copy of components/user/SearchDialog.tsx) sat unnoticed. Warn, not ' +
        "error, because some orphans are legitimate (Next.js route handlers and page.tsx " +
        "files are 'orphans' by dependency-cruiser's definition since the framework, not " +
        'another source file, is what calls them) — pathNot below excludes those, plus ' +
        "dependency-cruiser's own default exclusions (dotfiles, .d.ts, tsconfig, etc).",
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.(c|m)?ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(?:babel|webpack)\\.config\\.(?:js|cjs|mjs|ts|json)$',
          '(^|/)(page|layout|route|loading|error|not-found|global-error|middleware|instrumentation)\\.tsx?$',
          '\\.(test|spec)\\.tsx?$',
          '(^|/)(vitest|playwright)\\.config\\.ts$'
        ].join('|')
      },
      to: {}
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A circular import chain (A imports B imports A). Not something this project has ' +
        'been caught with yet, but it is exactly the kind of thing that gets introduced ' +
        'silently as files move between the root/ and src/ folder split this project has, ' +
        'and it is cheap to guard against categorically rather than wait to find one.',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'repositories-services-server-only',
      severity: 'error',
      comment:
        'src/repositories/** and src/services/** contain the one place in this codebase ' +
        '(checkout) that does price/stock validation with the rigor a financial system ' +
        'needs (optimistic-lock compare-and-swap, server-recomputed pricing). They must ' +
        'only be reachable from server-side entry points (route handlers, Server Actions) ' +
        '— never from a client component, which would mean bypassing that validation ' +
        'entirely from the browser.',
      from: {
        path: '^(components|src/features/.*/components|src/components)'
      },
      to: {
        path: '^src/(repositories|services)/'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    }
  }
}
