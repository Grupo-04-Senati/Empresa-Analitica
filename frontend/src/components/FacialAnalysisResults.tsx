import React from 'react';
import {
  X, Eye, Scissors, Smile, Circle, Triangle, Maximize2,
  Sparkles, BarChart3, TrendingUp, Droplets
} from 'lucide-react';
import {
  FacialAnalysis, SHAPE_LABELS, SHAPE_ICONS
} from '../services/facialAttributeAnalysis';

interface Props {
  analysis: FacialAnalysis;
  onClose: () => void;
  onSave?: (analysis: FacialAnalysis) => void;
}

function ScoreBar({ value, max = 100, color = '#3b82f6' }: { value: number; max?: number; color?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function Section({ title, icon, children, color = '#3b82f6' }: { title: string; icon: React.ReactNode; children: React.ReactNode; color?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          {icon}
        </div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      </div>
      <div className="bg-slate-50 rounded-xl px-3 py-2 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export const FacialAnalysisResults: React.FC<Props> = ({ analysis, onClose, onSave }) => {
  const a = analysis;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" />
            <h3 className="font-bold text-slate-800">Analisis Facial Completo</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Final Score */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-purple-500 mb-2">
              <span className="text-2xl font-black text-purple-600">{a.puntuacionFinal}</span>
            </div>
            <p className="text-xs text-slate-500">Puntuacion Facial / 100</p>
          </div>

          {/* Face Shape */}
          <Section title="Forma del Rostro" icon={<Circle size={16} style={{ color: '#8b5cf6' }} />} color="#8b5cf6">
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{SHAPE_ICONS[a.formaRostro.principal]}</span>
                <span className="text-sm font-bold text-purple-700">{SHAPE_LABELS[a.formaRostro.principal]}</span>
              </div>
            </div>
            {Object.entries(a.formaRostro.percentages)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 mb-1">
                  <span className="text-xs w-20 text-slate-600">{SHAPE_LABELS[k]}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${v}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{v}%</span>
                </div>
              ))}
          </Section>

          {/* Proportions */}
          <Section title="Proporciones" icon={<Maximize2 size={16} style={{ color: '#06b6d4' }} />} color="#06b6d4">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center bg-white rounded-lg p-2">
                <div className="text-xs text-slate-500">Frente</div>
                <div className="text-lg font-bold text-cyan-600">{a.proporciones.terciosVerticales.frente}%</div>
              </div>
              <div className="text-center bg-white rounded-lg p-2">
                <div className="text-xs text-slate-500">Nariz</div>
                <div className="text-lg font-bold text-cyan-600">{a.proporciones.terciosVerticales.nariz}%</div>
              </div>
              <div className="text-center bg-white rounded-lg p-2">
                <div className="text-xs text-slate-500">Menton</div>
                <div className="text-lg font-bold text-cyan-600">{a.proporciones.terciosVerticales.menton}%</div>
              </div>
            </div>
            <AttrRow label="Indice de ovalidad" value={a.proporciones.ovalidadIndice} />
            <AttrRow label="Relacion ancho/altura" value={a.proporciones.anchuraAltura} />
          </Section>

          {/* Golden Ratio */}
          <Section title="Proporcion Aurea" icon={<TrendingUp size={16} style={{ color: '#f59e0b' }} />} color="#f59e0b">
            <div className="text-center mb-2">
              <span className="text-2xl font-black text-amber-500">{a.proporcionesAureas.ratioGeneral}</span>
              <span className="text-xs text-slate-500 ml-2">(ideal: 1.618)</span>
            </div>
            <ScoreBar value={a.proporcionesAureas.puntuacion} color="#f59e0b" />
          </Section>

          {/* Eyes */}
          <Section title="Ojos" icon={<Eye size={16} style={{ color: '#ef4444' }} />} color="#ef4444">
            <AttrRow label="Tamano" value={a.ojos.tamano} />
            <AttrRow label="Forma" value={a.ojos.forma} />
            <AttrRow label="Separacion" value={a.ojos.separacion} />
            <AttrRow label="Inclinacion" value={a.ojos.inclinacion} />
            <AttrRow label="Tamano relativo" value={a.ojos.tamanoRelativo} />
            <AttrRow label="Distancia interpupilar" value={`${a.ojos.distanciaInterpupilar}px`} />
            <AttrRow label="Angulo" value={`${a.ojos.anguloInclinacion}°`} />
            <AttrRow label="EAR izq/der" value={`${a.ojos.relacionAspectoIzq} / ${a.ojos.relacionAspectoDer}`} />
          </Section>

          {/* Eyebrows */}
          <Section title="Cejas" icon={<Scissors size={16} style={{ color: '#ec4899' }} />} color="#ec4899">
            <AttrRow label="Grosor" value={a.cejas.grosor} />
            <AttrRow label="Arco" value={a.cejas.arco} />
            <AttrRow label="Longitud" value={a.cejas.longitud} />
            <AttrRow label="Separacion" value={a.cejas.separacion} />
            <AttrRow label="Inclinacion" value={a.cejas.inclinacionStr} />
            <AttrRow label="Distancia entre cejas" value={`${a.cejas.distanciaEntreCejas}px`} />
            <AttrRow label="Angulo" value={`${a.cejas.inclinacion}°`} />
          </Section>

          {/* Nose */}
          <Section title="Nariz" icon={<Triangle size={16} style={{ color: '#10b981' }} />} color="#10b981">
            <AttrRow label="Forma" value={a.nariz.forma} />
            <AttrRow label="Relacion largo/ancho" value={a.nariz.relacionLargoAncho} />
            <AttrRow label="Ancho relativo" value={a.nariz.anchoRelativo} />
            <AttrRow label="Proyeccion punta" value={a.nariz.proyeccionPunta} />
            <AttrRow label="Largo" value={`${a.nariz.largo}px`} />
            <AttrRow label="Ancho" value={`${a.nariz.ancho}px`} />
            <AttrRow label="Angulo puente" value={`${a.nariz.anguloPuente}°`} />
          </Section>

          {/* Lips */}
          <Section title="Labios" icon={<Smile size={16} style={{ color: '#f97316' }} />} color="#f97316">
            <AttrRow label="Plenitud" value={a.labios.plenitud} />
            <AttrRow label="Espesor" value={a.labios.espesor} />
            <AttrRow label="Forma arco cupido" value={a.labios.formaArcoCupido} />
            <AttrRow label="Ancho relativo" value={a.labios.anchoRelativo} />
            <AttrRow label="Relacion sup/inf" value={a.labios.relacionSupInf} />
            <AttrRow label="Labio superior" value={`${a.labios.espesorSup}px`} />
            <AttrRow label="Labio inferior" value={`${a.labios.espesorInf}px`} />
            <AttrRow label="Distancia nariz-labios" value={`${a.labios.distanciaNarizLabios}px`} />
          </Section>

          {/* Jaw */}
          <Section title="Mandibula y Menton" icon={<BarChart3 size={16} style={{ color: '#6366f1' }} />} color="#6366f1">
            <AttrRow label="Angulo" value={`${a.mandibula.anguloMandibula}°`} />
            <AttrRow label="Tipo de angulo" value={a.mandibula.tipoAngulo} />
            <AttrRow label="Definicion" value={a.mandibula.definicion} />
            <AttrRow label="Menton" value={a.mandibula.tipoMenton} />
            <AttrRow label="Ancho relativo" value={a.mandibula.anchuraRelativa} />
            <AttrRow label="Proyeccion menton" value={`${a.mandibula.proyeccionMenton}px`} />
            <AttrRow label="Ancho mandibula" value={`${a.mandibula.anchoMandibula}px`} />
          </Section>

          {/* Symmetry */}
          <Section title="Simetria Facial" icon={<Sparkles size={16} style={{ color: '#0ea5e9' }} />} color="#0ea5e9">
            <div className="mb-2">
              <span className="text-xs text-slate-500">Global</span>
              <ScoreBar value={a.simetria.global} color="#0ea5e9" />
            </div>
            <AttrRow label="Ojos" value={`${a.simetria.ojos}%`} />
            <AttrRow label="Nariz" value={`${a.simetria.nariz}%`} />
            <AttrRow label="Boca" value={`${a.simetria.boca}%`} />
            <AttrRow label="Mandibula" value={`${a.simetria.mandibula}%`} />
            <AttrRow label="Cejas" value={`${a.simetria.cejas}%`} />
          </Section>

          {/* Colors (if available) */}
          {a.colores && (
            <Section title="Tonos de Color" icon={<Droplets size={16} style={{ color: '#a855f7' }} />} color="#a855f7">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-slate-300" style={{ backgroundColor: `rgb(${a.colores.tonoPiel.rgb.join(',')})` }} />
                  <span className="text-xs font-medium text-slate-700">{a.colores.tonoPiel.clasificacion}</span>
                </div>
              </div>
              <AttrRow label="Clasificacion Fitzpatrick" value={a.colores.tonoPiel.Fitzpatrick} />
              <AttrRow label="Color de cabello" value={a.colores.colorCabello.estimado} />
              <AttrRow label="Color de labios" value={a.colores.colorLabios.estimado} />
            </Section>
          )}

          {/* Harmony */}
          <Section title="Armonia General" icon={<Sparkles size={16} style={{ color: '#8b5cf6' }} />} color="#8b5cf6">
            <ScoreBar value={a.armoniaGeneral} color="#8b5cf6" />
            <div className="mt-1 text-center">
              <span className="text-xs text-slate-500">{a.totalAtributos} atributos analizados</span>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-slate-200 shrink-0">
          {onSave && (
            <button onClick={() => onSave(analysis)} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-700 hover:to-indigo-700 transition-all">
              Guardar Analisis
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
