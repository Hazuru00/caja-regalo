export interface Frase {
  id: string
  label: string
  variantes: string[]
}

export const FRASES: Frase[] = [
  { id: 'te-amo', label: 'Te amo', variantes: ['te amo', 'ti amo', 'love'] },
  { id: 'te-quiero', label: 'Te quiero', variantes: ['te quiero', 'tequiero', 'tkm'] },
  { id: 'mi-amor', label: 'Mi amor', variantes: ['mi amor'] },
  {
    id: 'buenas-noches',
    label: 'Buenas noches',
    variantes: ['buenas noches', 'buenas nochi', 'dulces suenos', 'sena lindo', 'que descanses', 'descansa'],
  },
  { id: 'buenos-dias', label: 'Buenos días', variantes: ['buenos dias', 'buen dia'] },
  { id: 'te-extrano', label: 'Te extraño', variantes: ['te extrano'] },
  { id: 'nena', label: 'Nena', variantes: ['nena'] },
  { id: 'osito', label: 'Osito', variantes: ['osito'] },
]
