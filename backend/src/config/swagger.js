/**
 * Swagger/OpenAPI Configuration
 * API Documentation for NEXUS Platform
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NEXUS API',
      version: '1.0.0',
      description: `
# NEXUS Platform API

API REST pour la plateforme NEXUS - SaaS multi-tenant pour professionnels du service.

## Authentification

### Admin API (Dashboard)
Utilisez un token JWT dans le header Authorization:
\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

### Public API v1 (Integrations)
Utilisez une API Key (plan Business requis):
\`\`\`
Authorization: Bearer nxk_prod_xxxxxxxxxxxxx
\`\`\`

## Multi-Tenant
Toutes les requetes necessitent un tenant_id. Le tenant est resolu via:
- Header \`X-Tenant-ID\`
- Header \`X-Tenant-Slug\`
- Domaine custom
- Sous-domaine

## Rate Limiting
- API generale: 100 req/min
- Paiements: 10 req/min
- Login: 5 tentatives/15min
      `,
      contact: {
        name: 'NEXUS Support',
        email: 'support@nexus.ai',
        url: 'https://nexus.ai'
      },
      license: {
        name: 'Proprietary',
        url: 'https://nexus.ai/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development'
      },
      {
        url: 'https://api.nexus.ai',
        description: 'Production'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des sessions' },
      { name: 'Clients', description: 'Gestion des clients' },
      { name: 'Reservations', description: 'Gestion des reservations' },
      { name: 'Services', description: 'Catalogue de services' },
      { name: 'Factures', description: 'Facturation et paiements' },
      { name: 'Analytics', description: 'Statistiques et rapports' },
      { name: 'API Public', description: 'API REST v1 pour integrations' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT pour admin dashboard'
        },
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'API Key (nxk_prod_xxx) pour API publique'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
            code: { type: 'string', example: 'ERROR_CODE' }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenant_id: { type: 'string', format: 'uuid' },
            nom: { type: 'string', example: 'Dupont' },
            prenom: { type: 'string', example: 'Marie' },
            email: { type: 'string', format: 'email' },
            telephone: { type: 'string', example: '+33612345678' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenant_id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            service_id: { type: 'string', format: 'uuid' },
            date_rdv: { type: 'string', format: 'date-time' },
            statut: { 
              type: 'string', 
              enum: ['confirme', 'en_attente', 'annule', 'termine']
            },
            montant: { type: 'integer', description: 'Montant en centimes' }
          }
        },
        Service: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenant_id: { type: 'string', format: 'uuid' },
            nom: { type: 'string', example: 'Coupe Homme' },
            description: { type: 'string' },
            prix: { type: 'integer', description: 'Prix en centimes' },
            duree: { type: 'integer', description: 'Duree en minutes' },
            actif: { type: 'boolean' }
          }
        },
        Plan: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ['starter', 'pro', 'business'] },
            name: { type: 'string' },
            price: { type: 'integer', description: 'Prix mensuel en centimes' },
            features: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Non autorise - Token invalide ou manquant',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        Forbidden: {
          description: 'Acces refuse - Plan insuffisant',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFound: {
          description: 'Ressource non trouvee',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        RateLimited: {
          description: 'Trop de requetes',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'rate_limit_exceeded' },
                  retry_after: { type: 'integer', example: 60 }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app) {
  // Serve Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NEXUS API Documentation'
  }));

  // Serve OpenAPI JSON
  app.get('/api/docs.json', (req, res) => {
    res.json(specs);
  });

  console.log('[SWAGGER] API documentation available at /api/docs');
}

export default { setupSwagger, specs };
