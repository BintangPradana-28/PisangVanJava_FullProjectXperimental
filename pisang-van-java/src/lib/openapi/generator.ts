import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

export function getOpenApiSpec() {
  // 1. Extend Zod immediately inside the function execution to prevent tree-shaking
  extendZodWithOpenApi(z)

  const registry = new OpenAPIRegistry()

  // 2. Load schemas dynamically inside the execution scope to ensure prototype decoration is complete
  const { loginSchema, registerSchema } = require('@/src/features/auth/schemas')
  const { createOrderInputSchema, validateVoucherInputSchema, deliveryUpdateSchema } = require('@/src/features/checkout/schemas')

  // 3. Register request schemas
  registry.register('LoginRequest', loginSchema)
  registry.register('RegisterRequest', registerSchema)
  registry.register('CreateOrderRequest', createOrderInputSchema)
  registry.register('ValidateVoucherRequest', validateVoucherInputSchema)
  registry.register('DeliveryUpdateRequest', deliveryUpdateSchema)

  // 4. Register paths/endpoints
  registry.registerPath({
    method: 'post',
    path: '/api/auth/login',
    summary: 'User Sign In',
    request: {
      body: {
        content: {
          'application/json': {
            schema: loginSchema
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Login successful'
      }
    }
  })

  registry.registerPath({
    method: 'post',
    path: '/api/auth/register',
    summary: 'User Registration',
    request: {
      body: {
        content: {
          'application/json': {
            schema: registerSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'User registered successfully'
      }
    }
  })

  registry.registerPath({
    method: 'post',
    path: '/api/orders',
    summary: 'Create Checkout Order',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createOrderInputSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Order created successfully'
      }
    }
  })

  registry.registerPath({
    method: 'post',
    path: '/api/vouchers/validate',
    summary: 'Validate Voucher Code',
    request: {
      body: {
        content: {
          'application/json': {
            schema: validateVoucherInputSchema
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Voucher validation result'
      }
    }
  })

  // 5. Generate and return OpenApi document
  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Pisang Van Java POS & Storefront API',
      description: 'API Documentation for Pisang Van Java F&B Point of Sale and Storefront engines.'
    },
    servers: [{ url: '/' }]
  })
}
