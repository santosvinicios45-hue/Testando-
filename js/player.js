/* =====================================================================
 * V — controle, física e estado de animação.
 * Movimento com aceleração/atrito, "coyote time" e buffer de pulo para
 * resposta suave; pulo variável (soltar o botão encurta o salto).
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;

  const CFG = {
    maxSpeed: 92, accelGround: 950, accelAir: 620, friction: 1200,
    gravity: 980, maxFall: 560, jumpVel: 335, jumpCut: 0.5,
    coyote: 0.1, jumpBuffer: 0.12, flyAccel: 1100, flyVel: 175,
  };
  G.PLAYER_CFG = CFG;

  class Player {
    constructor(x, y) {
      this.x = x; this.y = y; this.w = 10; this.h = 26;
      this.vx = 0; this.vy = 0; this.facing = 1;
      this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.dropT = 0; this.jumpCut = false;
      this.anim = 0; this.state = 'idle';
      this.locked = false;       // cenas: sem controle do jogador
      this.pose = null;          // 'sit' | 'sitFloor' | 'lie' | 'sleep' | 'collapse'
      this.poseFacing = 1;
      this.stun = 0;
      this.flyEnabled = false; this.flyFuel = 0; this.flying = false;
      this.powerAim = null;      // ponto (mundo) para onde o braço aponta
      this.powerGlow = 0;
      this.landT = 0; this.stepT = 0;
      this.walkTo = null;        // x alvo em cenas
      this.fallStart = null;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    setPose(pose, x, y, facing) {
      this.pose = pose;
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
      if (facing) this.facing = facing;
      this.vx = 0; this.vy = 0;
    }
    clearPose() { this.pose = null; }

    standingOnOneWay(game) {
      const ty = Math.floor((this.y + this.h + 0.5) / TS);
      const x0 = Math.floor(this.x / TS), x1 = Math.floor((this.x + this.w - 0.001) / TS);
      let oneWay = false, solid = false;
      for (let tx = x0; tx <= x1; tx++) {
        const d = game.world.def(tx, ty);
        if (d.solid) solid = true; else if (d.oneWay) oneWay = true;
      }
      if (this.groundRef && this.groundRef.platform) oneWay = true;
      return oneWay && !solid;
    }

    update(dt, game) {
      const inp = game.input;
      if (this.stun > 0) this.stun -= dt;
      if (this.powerGlow > 0) this.powerGlow = Math.max(0, this.powerGlow - dt * 2);
      this.anim += dt;

      // poses (sentado, deitado...) congelam a física
      if (this.pose) {
        this.state = this.pose;
        if (!this.locked && game.canControl() && (inp.hit('left') || inp.hit('right') || inp.hit('jump'))) {
          this.pose = null; this.vy = 0;
          G.Physics.unstick(this, game.world);
        }
        return;
      }

      const control = !this.locked && this.stun <= 0 && game.canControl();
      let move = 0;
      if (control) {
        if (inp.is('left')) move -= 1;
        if (inp.is('right')) move += 1;
      }
      if (this.walkTo !== null) {
        const d = this.walkTo - this.x;
        if (Math.abs(d) < 1.5) { this.walkTo = null; this.vx = 0; } else move = Math.sign(d) * 0.75;
      }

      // horizontal
      const accel = this.onGround ? CFG.accelGround : CFG.accelAir;
      if (move !== 0) {
        this.vx = U.approach(this.vx, move * CFG.maxSpeed, accel * dt);
        this.facing = move > 0 ? 1 : -1;
      } else {
        this.vx = U.approach(this.vx, 0, (this.onGround ? CFG.friction : CFG.friction * 0.35) * dt);
      }
      if (this.powerAim && move === 0) this.facing = this.powerAim.x >= this.cx ? 1 : -1;

      // pulo
      if (this.onGround) this.coyote = CFG.coyote; else this.coyote -= dt;
      if (control && inp.hit('jump')) this.jumpBuf = CFG.jumpBuffer; else this.jumpBuf -= dt;
      if (control && inp.hit('down') && this.onGround && this.standingOnOneWay(game)) this.dropT = 0.22;
      if (this.dropT > 0) this.dropT -= dt;
      if (this.jumpBuf > 0 && this.coyote > 0) {
        this.vy = -CFG.jumpVel; this.jumpBuf = 0; this.coyote = 0; this.jumpCut = false;
        game.audio.play('jump', 0.7);
        game.particles.dust(this.cx, this.y + this.h, 3);
      }
      if (!inp.is('jump') && this.vy < -80 && !this.jumpCut && !this.flying) { this.vy *= CFG.jumpCut; this.jumpCut = true; }

      // teste de voo (cap. 2): segurar Pular no ar ergue V — sem controle fino ainda
      this.flying = false;
      if (this.flyEnabled && !this.onGround && control && inp.is('jump') && this.flyFuel > 0) {
        this.vy = U.approach(this.vy, -CFG.flyVel, CFG.flyAccel * dt);
        this.flyFuel -= dt; this.flying = true;
        if (Math.random() < 0.6) game.particles.spark(this.cx + U.rand(-3, 3), this.y + this.h, '#bfe3ff');
      }
      if (this.onGround) this.flyFuel = 1.4;

      // gravidade
      if (!this.flying) this.vy = Math.min(this.vy + CFG.gravity * dt, CFG.maxFall);

      const wasGround = this.onGround;
      if (!this.onGround && this.fallStart === null) this.fallStart = this.y;
      G.Physics.move(this, game.world, {
        dt, dropThrough: this.dropT > 0,
        solids: game.solidProps(),
        platforms: game.platformProps(),
        onPush: (s, d) => {
          if (s.T && s.T.pushable && !s.held && wasGround) {
            const push = Math.sign(d) * Math.min(CFG.maxSpeed * 0.6, 160 / s.mass);
            s.vx = push;
          }
        },
      });

      if (this.hitCeil) {
        if (this.flyingBefore || this.flying) game.bus.emit('player:ceiling', { flying: true, speed: this.impactY });
        else if (this.impactY > 120) game.audio.play('tick', 0.5);
      }
      this.flyingBefore = this.flying;

      // aterrissagem
      if (this.onGround && !wasGround) {
        const fall = this.fallStart !== null ? this.y - this.fallStart : 0;
        if (this.impactY > 200 || fall > 24) {
          game.audio.play('land', Math.min(1, this.impactY / 400));
          game.particles.dust(this.cx, this.y + this.h, Math.min(10, 2 + Math.floor(this.impactY / 80)));
          this.landT = 0.12;
          if (fall > TS * 7) { this.stun = Math.max(this.stun, 0.35); game.shake(3); }
        }
        this.fallStart = null;
      }
      if (this.onGround) this.fallStart = null;
      if (this.landT > 0) this.landT -= dt;

      // passos
      if (this.onGround && Math.abs(this.vx) > 20) {
        this.stepT -= dt * Math.abs(this.vx) / CFG.maxSpeed;
        if (this.stepT <= 0) { this.stepT = 0.28; game.audio.play('step', 0.5); }
      }

      // estado de animação
      if (this.stun > 0) this.state = 'stun';
      else if (this.flying) this.state = 'fly';
      else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.vx) > 8) this.state = 'walk';
      else this.state = 'idle';
    }

    serialize() { return { x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, facing: this.facing }; }
  }
  G.Player = Player;
})(window.VG = window.VG || {});
