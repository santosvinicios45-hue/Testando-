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
      this.x = x; this.y = y; this.w = 10; this.h = G.PH;
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
      this.stairDir = 0; this.onSlope = false; this.hover = false; this.carry = null; this.sweepT = 0; this.poseQueue = null; this.poseDone = null; this.running = false;
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
    clearPose() { this.pose = null; this.poseQueue = null; this.poseDone = null; }

    /** Levanta com animação (deitado → sentado → em pé). done roda quando estiver de pé. */
    getUp(done) {
      if (!this.pose) { if (done) done(); return; }
      const seq = [];
      if (this.pose === 'lie' || this.pose === 'sleep') seq.push({ pose: 'sit', dur: 0.5 });
      if (this.pose === 'collapse') seq.push({ pose: 'sitFloor', dur: 0.6 });
      seq.push({ pose: 'rise', dur: 0.25 });
      this.poseQueue = seq; this.poseDone = done || null; this.pose = seq[0].pose;
    }

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
        if (this.poseQueue) {
          const q = this.poseQueue[0];
          q.dur -= dt;
          if (q.dur <= 0) {
            this.poseQueue.shift();
            if (this.poseQueue.length) this.pose = this.poseQueue[0].pose;
            else {
              this.poseQueue = null; this.pose = null; this.vy = 0;
              G.Physics.unstick(this, game.world);
              const d = this.poseDone; this.poseDone = null;
              if (d) d();
            }
          }
          this.updateCarry(dt);
          return;
        }
        if (!this.locked && game.canControl() && (inp.hit('left') || inp.hit('right') || inp.hit('jump'))) this.getUp();
        this.updateCarry(dt);
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
      this.running = control && move !== 0 && inp.is('run') && !(game.powers && game.powers.held);
      const maxSp = CFG.maxSpeed * (this.running ? 1.65 : 1);
      if (move !== 0) {
        this.vx = U.approach(this.vx, move * maxSp, accel * dt * (this.running ? 1.3 : 1));
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
      if (!inp.is('jump') && this.vy < -80 && !this.jumpCut && !this.hover) { this.vy *= CFG.jumpCut; this.jumpCut = true; }

      // voo livre (depois do cap. 2): no ar, apertar Pular entra em voo controlado.
      // W/S sobem e descem, A/D movem; encostar no chão encerra o voo.
      const livre = !!(game.powers && game.powers.vooLivre);
      this.flying = false;
      if (livre && control && !this.onGround && !this.hover && inp.hit('jump') && this.coyote <= 0 && game.powers.unravelT <= 0) {
        this.hover = true; this.jumpBuf = 0;
        game.audio.play('lift', 0.6);
      }
      if (this.hover && (this.onGround || !control || game.powers.unravelT > 0 || !livre)) this.hover = false;
      if (this.hover) {
        let my = 0;
        if (inp.is('jump')) my -= 1;
        if (inp.is('down')) my += 1;
        const sp = this.running ? 165 : 115;
        this.vx = U.approach(this.vx, move * sp, 520 * dt);
        this.vy = U.approach(this.vy, my * sp * 0.85 + (my ? 0 : Math.sin(this.anim * 3) * 6), 520 * dt);
        this.flying = true;
        game.powers.cost((my || move ? 7 : 4) * dt);
        if (Math.random() < 0.35) game.particles.spark(this.cx + U.rand(-3, 3), this.y + this.h, '#bfe3ff');
        this._flyEv = (this._flyEv || 0) - dt;
        if (this._flyEv <= 0) { this._flyEv = 1.2; game.bus.emit('fly', { x: this.cx, y: this.cy }); }
      } else if (this.flyEnabled && !this.onGround && control && inp.is('jump') && this.flyFuel > 0 && this.vy > -CFG.jumpVel * 0.6) {
        // teste de voo (cap. 2): segurar Pular no ar ergue V — sem controle fino ainda
        this.vy = U.approach(this.vy, -CFG.flyVel, CFG.flyAccel * dt);
        this.flyFuel -= dt; this.flying = true;
        if (Math.random() < 0.6) game.particles.spark(this.cx + U.rand(-3, 3), this.y + this.h, '#bfe3ff');
        this._flyEv = (this._flyEv || 0) - dt;
        if (this._flyEv <= 0) { this._flyEv = 0.6; game.bus.emit('fly', { x: this.cx, y: this.cy }); }
      }
      if (this.onGround) this.flyFuel = 1.4;

      // gravidade
      if (!this.flying) this.vy = Math.min(this.vy + CFG.gravity * dt, CFG.maxFall);

      const wasGround = this.onGround;
      if (!this.onGround && this.fallStart === null) this.fallStart = this.y;
      const prevX = this.x, prevY = this.y, prevFeet = this.y + this.h, wasSlope = this.onSlope;
      this.onSlope = false;
      G.Physics.move(this, game.world, {
        dt, dropThrough: this.dropT > 0, stepUp: 8, grounded: wasGround,
        solids: game.solidProps(),
        platforms: game.platformProps(),
        onPush: (s, d) => {
          if (s.T && s.T.pushable && !s.held && wasGround) {
            const push = Math.sign(d) * Math.min(CFG.maxSpeed * 0.6, 160 / s.mass);
            s.vx = push;
          }
        },
      });

      // degraus: nas bifurcações, S desce; sem S, mantém o sentido em que vinha (padrão: subir)
      const wantDown = control && inp.is('down');
      const prefer = wantDown ? 'down' : (this.stairDir > 0 ? 'down' : 'up');
      const sl = G.Physics.resolveSlope(this, game.world, { prevFeet, wasGround, prefer });
      if (sl === 'blocked') {
        this.x = prevX; this.y = prevY; this.vx = 0; this.vy = 0; this.onGround = wasGround; this.onSlope = wasSlope;
        if (wasSlope && game.world.isSolid(32, 22) && this.y < TS * 25 && !(this._hatchMsg > 0)) {
          game.bubble('O alçapão lá em cima está fechado.', 1.8, true); this._hatchMsg = 3;
        }
      } else if (sl === 'snap') {
        const d = this.y + this.h - prevFeet;
        if (Math.abs(d) > 1) this.stairDir = Math.sign(d);
      } else if (this.onGround) this.stairDir = 0;
      if (this._hatchMsg > 0) this._hatchMsg -= dt;

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

      this.updateCarry(dt);

      // estado de animação
      if (this.sweepT > 0) { this.sweepT -= dt; this.state = 'sweep'; return; }
      if (this.stun > 0) this.state = 'stun';
      else if (this.flying) this.state = 'fly';
      else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.vx) > 8) this.state = 'walk';
      else this.state = 'idle';
    }

    /** Objeto nas mãos (ex.: a vassoura): acompanha a mão de V. */
    updateCarry(dt) {
      const p = this.carry;
      if (!p) return;
      p.carried = true; p.vx = 0; p.vy = 0;
      if (this.sweepT > 0) {
        p.angle = this.facing * (0.5 + Math.sin(this.anim * 14) * 0.35);
        p.x = this.cx + this.facing * 8 - p.w / 2; p.y = this.y + 12;
      } else {
        p.angle = this.facing * 0.15;
        p.x = this.cx + this.facing * 6 - p.w / 2; p.y = this.y + 9;
      }
    }
    dropCarry() { if (this.carry) { this.carry.carried = false; this.carry.angle = 0; this.carry = null; } }

    serialize() { return { x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, facing: this.facing }; }
  }
  G.Player = Player;
})(window.VG = window.VG || {});
