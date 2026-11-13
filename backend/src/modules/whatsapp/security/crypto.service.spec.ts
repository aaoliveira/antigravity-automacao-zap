import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('deve criptografar e decriptografar uma chave com integridade AES-256-GCM', () => {
    const apiKey = 'evolution_secret_api_key_1234567890';
    const encrypted = service.encrypt(apiKey);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(apiKey);
    expect(encrypted.split('.')).toHaveLength(3);

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(apiKey);
  });

  it('deve mascarar corretamente chaves para visualização segura', () => {
    expect(service.maskApiKey('12345678901234')).toBe('1234...1234');
    expect(service.maskApiKey('short')).toBe('****');
    expect(service.maskApiKey(null)).toBe('');
  });

  it('deve lançar erro ao tentar decriptografar dados corrompidos', () => {
    expect(() => service.decrypt('dados.invalidos.corrompidos')).toThrow();
  });
});
