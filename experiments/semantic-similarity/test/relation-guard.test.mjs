import assert from "node:assert/strict";
import test from "node:test";
import { applyRelationGuard, relationGuard } from "../src/relation-guard.mjs";

test("detecta instrucciones incompatibles y conserva cambios de detalle", () => {
  assert.equal(relationGuard("Abre la persiana del cuarto.", "Cierra la persiana del cuarto."), "opposite_action");
  assert.equal(relationGuard("Reserva la sala para el lunes.", "Reserva la sala para el jueves."), null);
  assert.equal(relationGuard("Consulta el saldo de la cuenta.", "Revisa el saldo de la cuenta."), null);
  assert.equal(relationGuard("Envía la carta.", "Archiva la carta."), null);
  assert.equal(relationGuard("Abre la puerta.", "Cierra la ventana."), null);
});

test("detecta negación del mismo hecho sin bloquear paráfrasis diferentes", () => {
  assert.equal(relationGuard("La entrega fue confirmada.", "La entrega no fue confirmada."), "negation_mismatch");
  assert.equal(relationGuard("Olvidé la clave del portal.", "No recuerdo mi contraseña."), null);
});

test("conserva el puntaje del embedding y registra la razón de una regla", () => {
  const [pair] = applyRelationGuard([{ textA: "Enciende la lámpara.", textB: "Apaga la lámpara.", score: 0.94 }]);
  assert.equal(pair.embeddingScore, 0.94);
  assert.equal(pair.score, -1);
  assert.equal(pair.guardReason, "opposite_action");
});
