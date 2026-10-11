export type Language = 'mn' | 'en';
export type Prompt = { id: string; language: Language; text: string };
export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'finished';
export type Racer = {
  id: string;
  name: string;
  progress: number;
  mistakes: number;
  strokes: number;
  ready: boolean;
  completedAt: number | null;
  // Guest-room appearance only; not proof of ownership or a verified leaderboard identity.
  car?: string; trail?: string; sticker?: string; title?: string;
  bot?: boolean;
};
export type RoomSnapshot = {
  type: 'state';
  phase: RacePhase;
  prompt: Prompt;
  players: Racer[];
  startAt: number | null;
  durationMs: number;
  mode?: 'quick';
  matchId?: string;
  queueEndsAt?: number | null;
};
export const ROOM_CAPACITY = 6;
export const RACE_DURATION_MS = 90_000;

/** Practice corpus: original Mongolian phrases (no scraped copyrighted texts). */
export const PROMPTS: Record<Language, Prompt[]> = {
  mn: [
    { id: 'mn-1', language: 'mn', text: 'Монгол хэлний зөв бичих дүрмийг өдөр бүр дасгал хийж сайжруулна.' },
    { id: 'mn-2', language: 'mn', text: 'Өглөөний нар уулын оройгоос мандаж, хотын гудамжийг гэрэлтүүлэв.' },
    { id: 'mn-3', language: 'mn', text: 'Үүлс нүүж, өргөн талын салхи өвсний үзүүрийг зөөлөн хөдөлгөнө.' },
    { id: 'mn-4', language: 'mn', text: 'Бүтээлч хүмүүс шинэ санаагаа хуваалцаж, хамтдаа хөгжин дэвшдэг.' },
    { id: 'mn-5', language: 'mn', text: 'Хурдан бичихээс илүүтэй алдаагүй, тогтвортой бичиж сурах нь чухал.' },
    { id: 'mn-6', language: 'mn', text: 'Улаанбаатарын өвөл хүйтэн боловч хүмүүс халуун дулаан сэтгэлтэй.' },
    { id: 'mn-7', language: 'mn', text: 'Сурагчид номын санд цугларч, мэдлэгээ өргөжүүлэхээр хичээж байна.' },
    { id: 'mn-8', language: 'mn', text: 'Гэрэл гэгээтэй ирээдүйн төлөө өнөөдөр нэг шинэ зүйл сурцгаая.' },
    { id: 'mn-9', language: 'mn', text: 'Хөвсгөлийн цэнхэр нуурын мандалд үүрийн гэгээ тусахад уулсын сүүдэр аажмаар богиносож эхэлнэ.' },
    { id: 'mn-10', language: 'mn', text: 'Эрдэм мэдлэгийн үнэ цэнийг ойлгосон хүн өдөр бүр шинэ зүйл сурахаас хэзээ ч залхуурдаггүй.' },
    { id: 'mn-11', language: 'mn', text: 'Уралдаанд түрүүлэхийн тулд зөвхөн хурд биш анхаарал төвлөрөл, тэсвэр тэвчээр ч хэрэгтэй.' },
    { id: 'mn-12', language: 'mn', text: 'Монгол гэрийн тооноор тусах нарны гэрэл өглөөний нам гүмийг аядуухан эвдэж байлаа.' },
    { id: 'mn-13', language: 'mn', text: 'Өргөн талд салхи сэвэлзэж, алсын уулсын орой үүл манантай нийлсэн мэт харагдана.' },
    { id: 'mn-14', language: 'mn', text: 'Сайн төлөвлөгөө гаргасан баг зорилгодоо хүрэх замын саад бэрхшээлийг илүү амархан давдаг.' },
    { id: 'mn-15', language: 'mn', text: 'Хичээл зүтгэл, тууштай байдал хоёр хүний хөгжлийг дэмждэг хамгийн чухал хүчин зүйлс юм.' },
    { id: 'mn-16', language: 'mn', text: 'Гудамжны гэрэл асах үед нийслэлийн хөдөлгөөн аажмаар намжиж, хүмүүс гэрийн зүг яарна.' },
    { id: 'mn-17', language: 'mn', text: 'Тэнгэрийн оддыг ажиглах нь хүн төрөлхтөнд эрт дээр үеэс сониуч зан, шинэ нээлт төрүүлжээ.' },
    { id: 'mn-18', language: 'mn', text: 'Хурдтай бичдэг болохын тулд гарын байрлалаа зөв хадгалж, үсэг бүрийг анхааралтай дараарай.' },
    { id: 'mn-19', language: 'mn', text: 'Технологийн шинэ шийдэл нь хүмүүсийн өдөр тутмын ажлыг хөнгөвчилж, үнэ цэнтэй цаг хэмнэдэг.' },
    { id: 'mn-20', language: 'mn', text: 'Дулаахан хаврын өдөр цэцэрлэгийн модод ногоорч, шувуудын дуу хотын өглөөг чимдэг.' },
    { id: 'mn-21', language: 'mn', text: 'Цастай өвлийн шөнө гэрийн цонхоор харахад гудамжны гэрэл цасан ширхэгт ойж гялалзана.' },
    { id: 'mn-22', language: 'mn', text: 'Хүн өөрийн алдаанаас суралцаж чадвал дараагийн оролдлого бүр өмнөхөөсөө үр дүнтэй болдог.' },
    { id: 'mn-23', language: 'mn', text: 'Бидний хүрээлэн буй орчныг хамгаалах жижиг үйлдэл бүр ирээдүйд том өөрчлөлт авчирна.' },
    { id: 'mn-24', language: 'mn', text: 'Хөгжмийн аялгуу эгшиглэхэд хүмүүсийн сэтгэл тайвширч, өнгөрсөн сайхан дурсамж сэргэдэг.' },
    { id: 'mn-25', language: 'mn', text: 'Монголчуудын зочломтгой зан, өв уламжлал нь үеэс үед уламжлагдан өнөөдөр ч хадгалагджээ.' },
    { id: 'mn-26', language: 'mn', text: 'Өнөөдөр хийх ажлаа зөв эрэмбэлбэл маргаашийн асуудлыг эртнээс урьдчилан харж чадна.' },
    { id: 'mn-27', language: 'mn', text: 'Сургуулийн номын сан шинэ номоор баяжиж, сурагчдын сонирхлыг татах олон булан нээжээ.' },
    { id: 'mn-28', language: 'mn', text: 'Өндөр уулын оргилоос харахад гол мөрөн хөндийгөөр тахирлан урсах нь гайхамшигтай үзэгдэл юм.' },
    { id: 'mn-29', language: 'mn', text: 'Багийн гишүүд санал бодлоо чөлөөтэй солилцвол асуудлыг олон талаас нь шийдэх боломж нэмэгддэг.' },
    { id: 'mn-30', language: 'mn', text: 'Автомашины уралдаанд барианы шугам хамгийн чухал боловч замын турш баримтлах дүрэм мөн адил чухал.' },
    { id: 'mn-31', language: 'mn', text: 'Зөв бичих чадвар нь зөвхөн шалгалтад бус өдөр тутмын харилцаанд ч бодитой давуу тал болдог.' },
    { id: 'mn-32', language: 'mn', text: 'Уулын жимээр алхаж явахад цэвэр агаар, нарсны үнэр, шувуудын жиргээ сэтгэлийг сэргээдэг.' },
    { id: 'mn-33', language: 'mn', text: 'Хотын төвийн жижиг кофе шопт хүмүүс ажиллаж, ярилцаж, шинэ санаагаа тэмдэглэж сууна.' },
    { id: 'mn-34', language: 'mn', text: 'Хурдан шийдвэр гаргахаас өмнө мэдээллээ нягталж, үр дагаврыг нь бодож үзэх нь ухаалаг алхам.' },
    { id: 'mn-35', language: 'mn', text: 'Цахилгаан эрчим хүчийг хэмнэх энгийн дадал байгаль орчинд үзүүлэх сөрөг нөлөөг багасгана.' },
    { id: 'mn-36', language: 'mn', text: 'Дэлгэцийн өмнө удаан ажилладаг хүмүүс нүдээ амрааж, завсарлага авч хэвших шаардлагатай.' },
    { id: 'mn-37', language: 'mn', text: 'Монгол бичгийн соёл түүхэн олон үеийг дамжин хөгжиж, үндэсний өвөрмөц онцлогийг илэрхийлдэг.' },
    { id: 'mn-38', language: 'mn', text: 'Гарын арван хуруугаар зөв бичиж сурахад эхлээд удаан санагдавч давталт бүр ур чадварыг нэмнэ.' },
    { id: 'mn-39', language: 'mn', text: 'Их сургуулийн оюутнууд судалгааны төслөө танилцуулж, бодит асуудлыг шийдэх шинэ санаа дэвшүүлэв.' },
    { id: 'mn-40', language: 'mn', text: 'Тогтмол дасгал хийж чадсан хүн хурд, нарийвчлал хоёрын тэнцвэрийг аажмаар илүү сайн олдог.' },
    { id: 'mn-41', language: 'mn', text: 'Өглөө бүрийн нар мандах мөчид хотын дээгүүр зөөлөн гэрэл тарж, шинэхэн өдөр эхэлдэг.' },
    { id: 'mn-42', language: 'mn', text: 'Амжилтыг ганц өдөр хэмжихээс илүү олон долоо хоногийн турш ахиц дэвшлээ ажиглах хэрэгтэй.' },
    { id: 'mn-43', language: 'mn', text: 'Хур тунадас багатай бүс нутгийн малчид усны нөөцөө зөв төлөвлөж, байгальтайгаа зохицон амьдардаг.' },
    { id: 'mn-44', language: 'mn', text: 'Бичих хурдны хувийн рекордоо эвдэхэд сандарч яарахаас илүү жигд хэмнэлээ хадгалах нь үр дүнтэй.' },
    { id: 'mn-45', language: 'mn', text: 'Олон хүний хамтын хөдөлмөрөөр бүтсэн сайн систем өдөр тутмын жижиг үйлдлийг илүү ойлгомжтой болгодог.' },
    { id: 'mn-46', language: 'mn', text: 'Хүн бүр өөрийн хурдаар сурдаг учраас алдаагаа засаж, шинэ зорилго тавих нь чухал байдаг.' },
    { id: 'mn-47', language: 'mn', text: 'Дулааны улиралд тал нутгийн ногоон өнгө сэргэж, уудам хөндийд адуу мал тайван бэлчинэ.' },
    { id: 'mn-48', language: 'mn', text: 'Ирээдүйд хэрэгтэй ур чадвар эзэмшихийн тулд өнөөдрөөс эхлэн тасралтгүй суралцах нь хамгийн зөв сонголт.' }
  ],
  en: [
    { id: 'en-1', language: 'en', text: 'Practice makes progress when you stay focused on every keystroke.' },
    { id: 'en-2', language: 'en', text: 'Fast racers build good habits before they chase a personal record.' },
    { id: 'en-3', language: 'en', text: 'Small improvements each day can turn a beginner into a champion.' }
  ]
};
export const normalizeText = (value: string): string => value.normalize('NFC');
export const characters = (value: string): string[] => Array.from(normalizeText(value));
export const accuracyPercent = (correct: number, total: number): number =>
  total === 0 ? 100 : Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
export const wordsPerMinute = (correctCharacters: number, elapsedMs: number): number =>
  elapsedMs <= 0 ? 0 : Math.max(0, Math.round(correctCharacters / 5 / (elapsedMs / 60_000)));
export const choosePrompt = (language: Language, randomValue = Math.random()): Prompt => {
  const list = PROMPTS[language];
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(randomValue * list.length)))];
};
export const progressPercent = (correctCharacters: number, text: string): number =>
  Math.min(100, Math.round((correctCharacters / characters(text).length) * 100));
