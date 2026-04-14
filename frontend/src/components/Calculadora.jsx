import { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { formatMoney } from '../utils/helpers';

export default function Calculadora({ onClose }) {
  const [monto, setMonto] = useState('');
  const [interes, setInteres] = useState('');
  const [cuotas, setCuotas] = useState('');

  const montoN   = parseFloat(monto)   || 0;
  const interesN = parseFloat(interes) || 0;
  const cuotasN  = parseInt(cuotas)    || 0;

  const totalAPagar   = montoN > 0 ? Math.round(montoN * (1 + interesN / 100)) : 0;
  const precioCuota   = totalAPagar > 0 && cuotasN > 0 ? Math.floor(totalAPagar / cuotasN) : 0;
  const interesTotal  = totalAPagar - montoN;
  const hasResult     = montoN > 0 && cuotasN > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 420,
          padding: '28px 28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          position: 'relative',
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Calculadora de cuotas</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Inputs */}
        <style>{`
          .calc-input::-webkit-outer-spin-button,
          .calc-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          .calc-input { -moz-appearance: textfield; }
        `}</style>
        <div className="form-group">
          <label>Monto del préstamo</label>
          <input
            className="form-control calc-input"
            type="number"
            placeholder="Ej: 100000"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Interés (%)</label>
          <input
            className="form-control calc-input"
            type="number"
            placeholder="Ej: 20"
            value={interes}
            onChange={(e) => setInteres(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Cantidad de cuotas</label>
          <input
            className="form-control calc-input"
            type="number"
            placeholder="Ej: 6"
            value={cuotas}
            onChange={(e) => setCuotas(e.target.value)}
          />
        </div>

        {/* Resultado */}
        {hasResult && (
          <div style={{
            marginTop: 20,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Precio por cuota</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                {formatMoney(precioCuota)}
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total a pagar</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatMoney(totalAPagar)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Interés total</span>
                <span style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>{formatMoney(interesTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cuotas</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{cuotasN}x {formatMoney(precioCuota)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
