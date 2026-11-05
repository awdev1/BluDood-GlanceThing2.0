const cyrillic: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ў: 'w',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya'
}

const greek: Record<string, string> = {
  α: 'a',
  ά: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  έ: 'e',
  ζ: 'z',
  η: 'i',
  ή: 'i',
  θ: 'th',
  ι: 'i',
  ί: 'i',
  ϊ: 'i',
  ΐ: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  ό: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  ύ: 'y',
  ϋ: 'y',
  ΰ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
  ώ: 'o'
}

const initials = [
  'g',
  'kk',
  'n',
  'd',
  'tt',
  'r',
  'm',
  'b',
  'pp',
  's',
  'ss',
  '',
  'j',
  'jj',
  'ch',
  'k',
  't',
  'p',
  'h'
]

const vowels = [
  'a',
  'ae',
  'ya',
  'yae',
  'eo',
  'e',
  'yeo',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wo',
  'we',
  'wi',
  'yu',
  'eu',
  'ui',
  'i'
]

const finals = [
  '',
  'k',
  'k',
  'k',
  'n',
  'n',
  'n',
  't',
  'l',
  'k',
  'm',
  'l',
  'l',
  'l',
  'p',
  'l',
  'm',
  'p',
  'p',
  't',
  't',
  'ng',
  't',
  't',
  'k',
  't',
  'p',
  't'
]

const nonLatin = /[Ͱ-ϿЀ-ӿ가-힣]/

function matchCase(source: string, latin: string) {
  if (!latin || source === source.toLowerCase()) return latin
  return latin[0].toUpperCase() + latin.slice(1)
}

function hangul(code: number) {
  const index = code - 0xac00
  const initial = Math.floor(index / 588)
  const vowel = Math.floor((index % 588) / 28)
  const final = index % 28
  return initials[initial] + vowels[vowel] + finals[final]
}

export function needsRomanization(text: string) {
  return nonLatin.test(text)
}

export function romanize(text: string) {
  let result = ''

  for (const char of text) {
    const code = char.charCodeAt(0)
    const lower = char.toLowerCase()

    if (code >= 0xac00 && code <= 0xd7a3) result += hangul(code)
    else if (lower in cyrillic) result += matchCase(char, cyrillic[lower])
    else if (lower in greek) result += matchCase(char, greek[lower])
    else result += char
  }

  return result
}
