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
      this.stair = null; this.carry = null; this.sweepT = 0; this.poseQueue = null; this.poseDone = null; this.running = false;
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

    /** Pé de um lance de escada perto de V ('bottom' ou 'top'). */
    stairFoot(game, end) {
      for (const s of game.stairs || []) {
        const fx = end === 'bottom' ? s.x0 : s.x1, fy = end === 'bottom' ? s.y0 : s.y1;
        if (Math.abs(this.x - fx) < 10 && Math.abs(this.y + this.h - fy) < 3) return s;
      }
      return null;
    }
    enterStair(s, fromTop) {
      this.stair = { s, t: fromTop ? 0.995 : 0.005 };
      this.vx = 0; this.vy = 0;
    }
    updateStair(dt, game, control) {
      const inp = game.input, st = this.stair, s = st.s;
      const hx = Math.sign(s.x1 - s.x0) || 1;
      const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      let dir = 0;
      if (control) {
        if (inp.is('jump') || inp.is(hx > 0 ? 'right' : 'left')) dir = 1;
        if (inp.is('down') || inp.is(hx > 0 ? 'left' : 'right')) dir = -1;
      }
      const speed = (control && inp.is('run') ? 105 : 60) / L;
      st.t += dir * speed * dt;
      if (s.hatch && game.world.isSolid(32, 22) && st.t > 0.6) {
        st.t = 0.6;
        if (!(this._hatchMsg > 0)) { game.bubble('O alçapão lá em cima está trancado.', 1.8, true); this._hatchMsg = 2.5; }
      }
      if (this._hatchMsg > 0) this._hatchMsg -= dt;
      this.vx = 0; this.vy = 0; this.onGround = true;
      if (st.t >= 1) { this.x = s.x1; this.y = s.y1 - this.h; this.stair = null; return; }
      if (st.t <= 0) { this.x = s.x0; this.y = s.y0 - this.h; this.stair = null; return; }
      this.x = s.x0 + (s.x1 - s.x0) * st.t;
      // degraus de 8 px: o corpo sobe em "pulinhos" em vez de deslizar
      const rise = (s.y0 - s.y1) * st.t;
      this.y = s.y0 - Math.round(rise / 8) * 8 - this.h;
      if (dir) {
        this.facing = dir * hx > 0 ? 1 : -1;
        this.state = 'walk';
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.22; game.audio.play('step', 0.6); }
      } else this.state = 'idle';
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
      if (this.stair) { this.updateStair(dt, game, control); this.updateCarry(dt); return; }
      if (control && this.onGround) {
        const up = inp.hit('jump') && this.stairFoot(game, 'bottom');
        const down = inp.hit('down') && this.stairFoot(game, 'top');
        if (up) { this.enterStair(up, false); return; }
        if (down) { this.enterStair(down, true); return; }
      }
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
      if (!inp.is('jump') && this.vy < -80 && !this.jumpCut && !this.flying) { this.vy *= CFG.jumpCut; this.jumpCut = true; }

      // teste de voo (cap. 2): segurar Pular no ar ergue V — sem controle fino ainda
      this.flying = false;
      const livre = !!(game.powers && game.powers.vooLivre);
      if ((this.flyEnabled || livre) && !this.onGround && control && inp.is('jump') && this.flyFuel > 0 && this.vy > -CFG.jumpVel * 0.6) {
        this.vy = U.approach(this.vy, -CFG.flyVel, CFG.flyAccel * dt);
        this.flyFuel -= dt; this.flying = true;
        if (livre && !this.flyEnabled) game.powers.cost(12 * dt);
        if (Math.random() < 0.6) game.particles.spark(this.cx + U.rand(-3, 3), this.y + this.h, '#bfe3ff');
        this._flyEv = (this._flyEv || 0) - dt;
        if (this._flyEv <= 0) { this._flyEv = 0.6; game.bus.emit('fly', { x: this.cx, y: this.cy }); }
      }
      if (this.onGround) this.flyFuel = livre ? 2.8 : 1.4;

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
        p.x = this.cx + this.facing * 8 - p.w / 2; p.y = this.y + 6;
      } else {
        p.angle = this.facing * 0.15;
        p.x = this.cx + this.facing * 5 - p.w / 2; p.y = this.y + 4;
      }
    }
    dropCarry() { if (this.carry) { this.carry.carried = false; this.carry.angle = 0; this.carry = null; } }

    serialize() { return { x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, facing: this.facing }; }
  }
  G.Player = Player;
})(window.VG = window.VG || {});
