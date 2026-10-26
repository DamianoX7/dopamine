// Emoji that float up and fade over the house and the street: notes from the record player, hearts, sparkles, steam.
import * as THREE from '../vendor/three.module.min.js';
import { glyphMaterial, softDotTexture } from '../fox/kit.js';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
  }

  emit(glyph, at, { size = 0.13, rise = 0.32, life = 1.8, drift = 0.08 } = {}) {
    const sprite = new THREE.Sprite(glyphMaterial(glyph, glyph.length === 1 && /[♪♫]/.test(glyph) ? '#ff6f9c' : undefined).clone());
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 50;
    this.scene.add(sprite);
    this.live.push({ sprite, t: 0, life, size, vx: (Math.random() - 0.5) * drift * 2, vy: rise * (0.8 + Math.random() * 0.4) });
  }

  /** Steam (or smoke): a soft puff that rises, grows and fades. */
  puff(at, { color = '#ffffff', size = 0.06, rise = 0.22, life = 1.3, opacity = 0.5 } = {}) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 49;
    this.scene.add(sprite);
    this.live.push({ sprite, t: 0, life, size, vx: (Math.random() - 0.5) * 0.05, vy: rise * (0.8 + Math.random() * 0.4), grow: 2.2, peak: opacity });
  }

  update(dt) {
    this.live = this.live.filter((p) => {
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        return false;
      }
      p.sprite.position.x += p.vx * dt + Math.sin(p.t * 4) * 0.002;
      p.sprite.position.y += p.vy * dt;
      const fade = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
      p.sprite.material.opacity = fade * (p.peak || 1);
      if (p.grow) p.sprite.scale.setScalar(p.size * (1 + p.grow * k));
      return true;
    });
  }
}
