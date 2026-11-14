export interface Frase {
  id: string
  label: string
  variantes: string[]
}

export const FRASES: Frase[] = [
  { id: 'te-amo', label: 'Te amo', variantes: ['te amo', 'ti amo'] },
  { id: 'amor', label: 'Amor', variantes: ['amor'] },
  { id: 'love', label: 'Love', variantes: ['love'] },
  { id: 'mi-amor', label: 'Mi amor', variantes: ['mi amor'] },
  { id: 'mi-vida', label: 'Mi vida', variantes: ['mi vida'] },
  { id: 'te-quiero', label: 'Te quiero', variantes: ['te quiero', 'tequiero', 'tkm'] },
  {
    id: 'buenas-noches',
    label: 'Buenas noches',
    variantes: ['buenas noches', 'buenas nochi', 'dulces suenos', 'sena lindo', 'que descanses', 'descansa'],
  },
  { id: 'carino', label: 'Cariño', variantes: ['cariño', 'cariñito'] },
  { id: 'besos', label: 'Besos', variantes: ['besos', 'beso'] },
  { id: 'buenos-dias', label: 'Buenos días', variantes: ['buenos dias', 'buen dia'] },
  { id: 'te-extrano', label: 'Te extraño', variantes: ['te extrano'] },
  { id: 'osito', label: 'Osito', variantes: ['osito'] },
]
