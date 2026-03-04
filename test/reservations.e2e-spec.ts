import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

// Integrační testy ověřují celý průchod: HTTP request → Controller → Service → DB.
// Používáme reálnou PostgreSQL databázi (stejnou jako v CI).
// Proměnné prostředí DB_* jsou nastaveny v CI pipeline.

describe('Reservations (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM reservation');
    await dataSource.query('DELETE FROM room');
    await dataSource.query('DELETE FROM "user"');
    await app.close();
  });

  // Pomocné proměnné sdílené mezi testy
  let userId: number;
  let roomId: number;
  let reservationId: number;

  // -------------------------------------------------------
  // Vytvoření testovacích dat
  // -------------------------------------------------------
  it('POST /users — vytvoří uživatele', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Test User', email: 'test@example.com' })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'Test User', email: 'test@example.com' });
    userId = res.body.id as number;
  });

  it('POST /rooms — ADMIN může vytvořit místnost (HTTP 201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Zasedačka A', capacity: 10 })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'Zasedačka A' });
    roomId = res.body.id as number;
  });

  it('POST /rooms — USER nemůže vytvořit místnost (HTTP 403)', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .set('x-user-role', 'USER')
      .send({ name: 'Zasedačka B', capacity: 5 })
      .expect(403);
  });

  // -------------------------------------------------------
  // Rezervace
  // -------------------------------------------------------
  it('POST /reservations — vytvoří rezervaci (HTTP 201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send({
        roomId,
        userId,
        startAt: '2025-07-01T10:00:00',
        endAt: '2025-07-01T12:00:00',
      })
      .expect(201);

    expect(res.body).toMatchObject({ id: expect.any(Number) });
    reservationId = res.body.id as number;
  });

  it('POST /reservations — kolize časů vrátí HTTP 409', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send({
        roomId,
        userId,
        startAt: '2025-07-01T11:00:00', // překrývá se s předchozí
        endAt: '2025-07-01T13:00:00',
      })
      .expect(409);
  });

  it('DELETE /reservations/:id — zruší rezervaci (HTTP 200)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/reservations/${reservationId}`)
      .expect(200);

    expect(res.body).toMatchObject({ status: 'CANCELLED' });
  });

  it('DELETE /reservations/:id — zrušenou rezervaci nelze znovu zrušit (HTTP 400)', async () => {
    await request(app.getHttpServer())
      .delete(`/reservations/${reservationId}`)
      .expect(400);
  });
});
