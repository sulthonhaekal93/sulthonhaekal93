/*
 * BANK SOAL — English Fun Games
 * --------------------------------------------------------------
 * Format kata  : [kata_inggris, arti_indonesia, gambar, tingkat]
 *   - gambar   : emoji, kode warna "#rrggbb" (tema Warna),
 *                atau "" bila tidak ada gambar yang cocok.
 *   - tingkat  : 1 = mudah, 2 = sedang, 3 = sulit
 * Format kalimat: [kalimat_inggris, arti_indonesia, syarat?]
 *   - {w} kata, {W} kata (huruf besar), {a} a/an, {t} "the" + kata,
 *     {id} arti, {Id} arti (huruf besar)
 *   - syarat (opsional): { min, max } untuk nilai angka,
 *     { ex: ['kata'] } untuk mengecualikan kata tertentu.
 * Guru boleh menambah / mengubah kata di file ini.
 */
window.EFG_DATA = {
  themes: [
    {
      id: 'colors', name: 'Warna', en: 'Colors', icon: '🎨', kind: 'color',
      words: [
        ['red', 'merah', '#e53935', 1], ['blue', 'biru', '#1e88e5', 1],
        ['green', 'hijau', '#43a047', 1], ['yellow', 'kuning', '#fdd835', 1],
        ['black', 'hitam', '#212121', 1], ['white', 'putih', '#ffffff', 1],
        ['pink', 'merah muda', '#f48fb1', 1], ['brown', 'cokelat', '#795548', 1],
        ['orange', 'oranye', '#fb8c00', 1], ['purple', 'ungu', '#8e24aa', 1],
        ['grey', 'abu-abu', '#9e9e9e', 2], ['gold', 'emas', '#d4af37', 2],
        ['silver', 'perak', '#c0c0c0', 2], ['navy', 'biru dongker', '#1a237e', 2],
        ['cream', 'krem', '#fff3c4', 2], ['maroon', 'merah marun', '#800000', 2],
        ['lime', 'hijau limau', '#c0ca33', 2],
        ['turquoise', 'biru kehijauan', '#40e0d0', 3], ['violet', 'ungu muda', '#9c6ade', 3],
        ['beige', 'krem kecokelatan', '#d8c3a5', 3], ['magenta', 'merah keunguan', '#d81b60', 3],
        ['indigo', 'nila', '#3f51b5', 3], ['scarlet', 'merah menyala', '#ff2400', 3]
      ],
      sentences: {
        1: [['It is {w}.', 'Itu berwarna {id}.'], ['I like {w}.', 'Aku suka warna {id}.'],
            ['{W} is nice.', 'Warna {id} itu bagus.'], ['I see {w}.', 'Aku melihat warna {id}.']],
        2: [['My bag is {w}.', 'Tasku berwarna {id}.'], ['I have {a} {w} pencil.', 'Aku punya pensil berwarna {id}.'],
            ['Her dress is {w}.', 'Gaunnya berwarna {id}.'], ['The big ball is {w}.', 'Bola besar itu berwarna {id}.']],
        3: [['I want to paint my bedroom {w}.', 'Aku ingin mengecat kamar tidurku dengan warna {id}.'],
            ['My mother bought me {a} {w} umbrella yesterday.', 'Ibuku membelikanku payung berwarna {id} kemarin.'],
            ['The color of my new school bag is {w}.', 'Warna tas sekolah baruku adalah {id}.'],
            ['My little sister likes to wear {w} shoes.', 'Adik perempuanku suka memakai sepatu berwarna {id}.']]
      }
    },
    {
      id: 'numbers', name: 'Angka', en: 'Numbers', icon: '🔢', kind: 'number',
      words: [
        ['one', 'satu', '1', 1], ['two', 'dua', '2', 1], ['three', 'tiga', '3', 1],
        ['four', 'empat', '4', 1], ['five', 'lima', '5', 1], ['six', 'enam', '6', 1],
        ['seven', 'tujuh', '7', 1], ['eight', 'delapan', '8', 1], ['nine', 'sembilan', '9', 1],
        ['ten', 'sepuluh', '10', 1],
        ['eleven', 'sebelas', '11', 2], ['twelve', 'dua belas', '12', 2], ['thirteen', 'tiga belas', '13', 2],
        ['fourteen', 'empat belas', '14', 2], ['fifteen', 'lima belas', '15', 2], ['sixteen', 'enam belas', '16', 2],
        ['seventeen', 'tujuh belas', '17', 2], ['eighteen', 'delapan belas', '18', 2],
        ['nineteen', 'sembilan belas', '19', 2], ['twenty', 'dua puluh', '20', 2],
        ['thirty', 'tiga puluh', '30', 3], ['forty', 'empat puluh', '40', 3], ['fifty', 'lima puluh', '50', 3],
        ['sixty', 'enam puluh', '60', 3], ['seventy', 'tujuh puluh', '70', 3], ['eighty', 'delapan puluh', '80', 3],
        ['ninety', 'sembilan puluh', '90', 3], ['hundred', 'seratus', '100', 3], ['thousand', 'seribu', '1000', 3]
      ],
      sentences: {
        1: [['It is {w}.', 'Itu angka {id}.'], ['I see {w} cats.', 'Aku melihat {id} kucing.', { min: 2 }],
            ['I have {w} books.', 'Aku punya {id} buku.', { min: 2 }], ['Count to {w}.', 'Hitung sampai {id}.', { min: 2 }]],
        2: [['I have {w} red apples.', 'Aku punya {id} apel merah.', { min: 2 }],
            ['My brother is {w} years old.', 'Kakakku berumur {id} tahun.', { min: 2, max: 20 }],
            ['There are {w} chairs here.', 'Ada {id} kursi di sini.', { min: 2 }],
            ['Please count from one to {w}.', 'Tolong hitung dari satu sampai {id}.', { min: 2 }]],
        3: [['There are {w} students in my class.', 'Ada {id} murid di kelasku.', { min: 2, max: 50 }],
            ['My grandmother has {w} chickens on her farm.', 'Nenekku punya {id} ayam di peternakannya.', { min: 2 }],
            ['I can count from one to {w} in English.', 'Aku bisa berhitung dari satu sampai {id} dalam bahasa Inggris.', { min: 2 }],
            ['We need {w} pieces of paper for art class.', 'Kami butuh {id} lembar kertas untuk kelas seni.', { min: 2 }]]
      }
    },
    {
      id: 'animals', name: 'Hewan', en: 'Animals', icon: '🐾',
      words: [
        ['cat', 'kucing', '🐱', 1], ['dog', 'anjing', '🐶', 1], ['cow', 'sapi', '🐮', 1],
        ['duck', 'bebek', '🦆', 1], ['fish', 'ikan', '🐟', 1], ['bird', 'burung', '🐦', 1],
        ['ant', 'semut', '🐜', 1], ['bee', 'lebah', '🐝', 1], ['goat', 'kambing', '🐐', 1],
        ['frog', 'katak', '🐸', 1], ['fox', 'rubah', '🦊', 1], ['bat', 'kelelawar', '🦇', 1],
        ['owl', 'burung hantu', '🦉', 1],
        ['horse', 'kuda', '🐴', 2], ['sheep', 'domba', '🐑', 2], ['mouse', 'tikus', '🐭', 2],
        ['rabbit', 'kelinci', '🐰', 2], ['tiger', 'harimau', '🐯', 2], ['lion', 'singa', '🦁', 2],
        ['snake', 'ular', '🐍', 2], ['monkey', 'monyet', '🐒', 2], ['bear', 'beruang', '🐻', 2],
        ['zebra', 'zebra', '🦓', 2], ['camel', 'unta', '🐫', 2], ['snail', 'siput', '🐌', 2],
        ['whale', 'paus', '🐳', 2], ['shark', 'hiu', '🦈', 2], ['chicken', 'ayam', '🐔', 2],
        ['elephant', 'gajah', '🐘', 3], ['giraffe', 'jerapah', '🦒', 3], ['butterfly', 'kupu-kupu', '🦋', 3],
        ['crocodile', 'buaya', '🐊', 3], ['kangaroo', 'kanguru', '🦘', 3], ['penguin', 'penguin', '🐧', 3],
        ['octopus', 'gurita', '🐙', 3], ['dolphin', 'lumba-lumba', '🐬', 3], ['turtle', 'kura-kura', '🐢', 3],
        ['squirrel', 'tupai', '🐿️', 3], ['peacock', 'burung merak', '🦚', 3], ['parrot', 'burung beo', '🦜', 3],
        ['rhinoceros', 'badak', '🦏', 3]
      ],
      sentences: {
        1: [['It is {a} {w}.', 'Itu adalah {id}.'], ['I see {a} {w}.', 'Aku melihat {id}.'],
            ['This is {a} {w}.', 'Ini adalah {id}.'], ['Look at the {w}.', 'Lihat {id} itu.']],
        2: [['The {w} is very cute.', '{Id} itu sangat lucu.'], ['I can see {a} {w} there.', 'Aku bisa melihat {id} di sana.'],
            ['My friend draws {a} {w}.', 'Temanku menggambar {id}.'], ['Where is the {w} now?', 'Di mana {id} itu sekarang?']],
        3: [['We saw {a} {w} at the zoo yesterday.', 'Kami melihat {id} di kebun binatang kemarin.'],
            ['My little brother is drawing {a} {w} in his book.', 'Adik laki-lakiku sedang menggambar {id} di bukunya.'],
            ['Do you know what the {w} likes to eat?', 'Apakah kamu tahu apa yang {id} suka makan?'],
            ['The teacher told us a story about {a} {w}.', 'Guru bercerita kepada kami tentang seekor {id}.']]
      }
    },
    {
      id: 'fruits', name: 'Buah', en: 'Fruits', icon: '🍎',
      words: [
        ['apple', 'apel', '🍎', 1], ['banana', 'pisang', '🍌', 1], ['grape', 'anggur', '🍇', 1],
        ['mango', 'mangga', '🥭', 1], ['lemon', 'lemon', '🍋', 1], ['pear', 'pir', '🍐', 1],
        ['kiwi', 'kiwi', '🥝', 1], ['melon', 'melon', '🍈', 1], ['peach', 'persik', '🍑', 1],
        ['orange', 'jeruk', '🍊', 1],
        ['cherry', 'ceri', '🍒', 2], ['coconut', 'kelapa', '🥥', 2], ['avocado', 'alpukat', '🥑', 2],
        ['papaya', 'pepaya', '', 2], ['guava', 'jambu biji', '', 2], ['durian', 'durian', '', 2],
        ['starfruit', 'belimbing', '', 2],
        ['strawberry', 'stroberi', '🍓', 3], ['pineapple', 'nanas', '🍍', 3], ['watermelon', 'semangka', '🍉', 3],
        ['blueberry', 'bluberi', '🫐', 3], ['rambutan', 'rambutan', '', 3], ['mangosteen', 'manggis', '', 3],
        ['jackfruit', 'nangka', '', 3], ['pomegranate', 'delima', '', 3]
      ],
      sentences: {
        1: [['I eat {a} {w}.', 'Aku makan {id}.'], ['It is {a} {w}.', 'Itu adalah {id}.'],
            ['I like {w} juice.', 'Aku suka jus {id}.'], ['Is this {a} {w}?', 'Apakah ini {id}?']],
        2: [['The {w} is very fresh.', '{Id} itu sangat segar.'], ['My mother buys {a} {w}.', 'Ibuku membeli {id}.'],
            ['I want to eat {a} {w}.', 'Aku ingin makan {id}.'], ['The {w} is on the table.', '{Id} itu ada di atas meja.']],
        3: [['My father bought a big {w} at the market.', 'Ayahku membeli {id} besar di pasar.'],
            ['I always eat {a} {w} after lunch at school.', 'Aku selalu makan {id} setelah makan siang di sekolah.'],
            ['We made {w} juice for the party last night.', 'Kami membuat jus {id} untuk pesta tadi malam.'],
            ['My grandmother has {a} {w} tree in her garden.', 'Nenekku punya pohon {id} di kebunnya.']]
      }
    },
    {
      id: 'vegetables', name: 'Sayuran', en: 'Vegetables', icon: '🥕',
      words: [
        ['corn', 'jagung', '🌽', 1], ['carrot', 'wortel', '🥕', 1], ['potato', 'kentang', '🥔', 1],
        ['tomato', 'tomat', '🍅', 1], ['onion', 'bawang bombai', '🧅', 1], ['bean', 'kacang buncis', '🫘', 1],
        ['chili', 'cabai', '🌶️', 1], ['garlic', 'bawang putih', '🧄', 1], ['pea', 'kacang polong', '', 1],
        ['cabbage', 'kubis', '🥬', 2], ['cucumber', 'mentimun', '🥒', 2], ['eggplant', 'terong', '🍆', 2],
        ['mushroom', 'jamur', '🍄', 2], ['pumpkin', 'labu', '🎃', 2], ['pepper', 'paprika', '🫑', 2],
        ['peanut', 'kacang tanah', '🥜', 2], ['spinach', 'bayam', '', 2], ['lettuce', 'selada', '', 2],
        ['broccoli', 'brokoli', '🥦', 3], ['cauliflower', 'kembang kol', '', 3], ['celery', 'seledri', '', 3],
        ['radish', 'lobak', '', 3], ['asparagus', 'asparagus', '', 3], ['beetroot', 'bit merah', '', 3],
        ['ginger', 'jahe', '', 3]
      ],
      sentences: {
        1: [['This is {a} {w}.', 'Ini adalah {id}.'], ['It is {a} {w}.', 'Itu adalah {id}.'],
            ['I like {w} soup.', 'Aku suka sup {id}.'], ['I see {a} {w}.', 'Aku melihat {id}.']],
        2: [['My mother cooks {w} today.', 'Ibuku memasak {id} hari ini.'], ['The {w} is in the basket.', '{Id} itu ada di dalam keranjang.'],
            ['I do not like {w}.', 'Aku tidak suka {id}.'], ['We buy {w} every week.', 'Kami membeli {id} setiap minggu.']],
        3: [['My grandfather grows {w} in his big garden.', 'Kakekku menanam {id} di kebunnya yang besar.'],
            ['We should eat {w} every day to stay healthy.', 'Kita harus makan {id} setiap hari agar tetap sehat.'],
            ['My mother bought fresh {w} at the market this morning.', 'Ibuku membeli {id} segar di pasar pagi ini.'],
            ['The farmer puts the {w} into a big basket.', 'Petani memasukkan {id} ke dalam keranjang besar.']]
      }
    },
    {
      id: 'jobs', name: 'Pekerjaan', en: 'Jobs', icon: '👩‍🏫',
      words: [
        ['cook', 'juru masak', '🧑‍🍳', 1], ['nurse', 'perawat', '💉', 1], ['farmer', 'petani', '🧑‍🌾', 1],
        ['pilot', 'pilot', '🧑‍✈️', 1], ['singer', 'penyanyi', '🎤', 1], ['driver', 'sopir', '🚕', 1],
        ['teacher', 'guru', '🧑‍🏫', 1], ['doctor', 'dokter', '🩺', 1], ['clown', 'badut', '🤡', 1],
        ['baker', 'tukang roti', '🍞', 1],
        ['dancer', 'penari', '💃', 2], ['painter', 'pelukis', '🧑‍🎨', 2], ['student', 'pelajar', '🧑‍🎓', 2],
        ['soldier', 'tentara', '💂', 2], ['builder', 'tukang bangunan', '👷', 2], ['tailor', 'penjahit', '🧵', 2],
        ['dentist', 'dokter gigi', '🦷', 2], ['barber', 'tukang cukur', '💈', 2], ['judge', 'hakim', '🧑‍⚖️', 2],
        ['policeman', 'polisi', '👮', 2],
        ['firefighter', 'pemadam kebakaran', '🧑‍🚒', 3], ['astronaut', 'astronot', '🧑‍🚀', 3],
        ['mechanic', 'montir', '🧑‍🔧', 3], ['scientist', 'ilmuwan', '🧑‍🔬', 3], ['fisherman', 'nelayan', '🎣', 3],
        ['detective', 'detektif', '🕵️', 3], ['programmer', 'pemrogram', '🧑‍💻', 3],
        ['photographer', 'fotografer', '📸', 3], ['postman', 'tukang pos', '📮', 3], ['gardener', 'tukang kebun', '🌻', 3]
      ],
      sentences: {
        1: [['He is {a} {w}.', 'Dia adalah seorang {id}.'], ['She is {a} {w}.', 'Dia adalah seorang {id}.'],
            ['I am {a} {w}.', 'Saya adalah seorang {id}.'], ['You are {a} {w}.', 'Kamu adalah seorang {id}.']],
        2: [['My father is {a} {w}.', 'Ayahku adalah seorang {id}.'], ['I want to be {a} {w}.', 'Aku ingin menjadi {id}.'],
            ['My aunt works as {a} {w}.', 'Bibiku bekerja sebagai {id}.'], ['Is your mother {a} {w}?', 'Apakah ibumu seorang {id}?']],
        3: [['When I grow up, I want to be {a} {w}.', 'Kalau sudah besar, aku ingin menjadi {id}.'],
            ['My uncle has worked as {a} {w} for ten years.', 'Pamanku sudah bekerja sebagai {id} selama sepuluh tahun.'],
            ['Every day the {w} works very hard.', 'Setiap hari {id} itu bekerja sangat keras.'],
            ['My best friend wants to become {a} {w} someday.', 'Sahabatku ingin menjadi {id} suatu hari nanti.']]
      }
    },
    {
      id: 'things', name: 'Kata Benda Sekitar', en: 'Things Around Us', icon: '🏠',
      words: [
        ['bed', 'tempat tidur', '🛏️', 1], ['cup', 'cangkir', '☕', 1], ['key', 'kunci', '🔑', 1],
        ['door', 'pintu', '🚪', 1], ['lamp', 'lampu', '💡', 1], ['ball', 'bola', '⚽', 1],
        ['hat', 'topi', '👒', 1], ['box', 'kotak', '📦', 1], ['sofa', 'sofa', '🛋️', 1],
        ['clock', 'jam dinding', '🕰️', 1], ['chair', 'kursi', '🪑', 1], ['phone', 'telepon', '📱', 1],
        ['bowl', 'mangkuk', '🥣', 1], ['fan', 'kipas angin', '', 1],
        ['table', 'meja', '', 2], ['spoon', 'sendok', '🥄', 2], ['fork', 'garpu', '🍴', 2],
        ['plate', 'piring', '🍽️', 2], ['window', 'jendela', '🪟', 2], ['mirror', 'cermin', '🪞', 2],
        ['broom', 'sapu', '🧹', 2], ['bucket', 'ember', '🪣', 2], ['soap', 'sabun', '🧼', 2],
        ['candle', 'lilin', '🕯️', 2], ['basket', 'keranjang', '🧺', 2], ['pillow', 'bantal', '', 2],
        ['towel', 'handuk', '', 2], ['radio', 'radio', '📻', 2], ['toilet', 'toilet', '🚽', 2],
        ['umbrella', 'payung', '☂️', 3], ['television', 'televisi', '📺', 3], ['computer', 'komputer', '💻', 3],
        ['bicycle', 'sepeda', '🚲', 3], ['glasses', 'kacamata', '👓', 3], ['camera', 'kamera', '📷', 3],
        ['toothbrush', 'sikat gigi', '🪥', 3], ['curtain', 'gorden', '', 3], ['cupboard', 'lemari', '', 3],
        ['blanket', 'selimut', '', 3]
      ],
      sentences: {
        1: [['It is {a} {w}.', 'Itu adalah {id}.'], ['This is my {w}.', 'Ini {id} milikku.'],
            ['I see {a} {w}.', 'Aku melihat {id}.'], ['Where is my {w}?', 'Di mana {id} milikku?']],
        2: [['The {w} is in my room.', '{Id} itu ada di kamarku.'], ['I clean the {w} every day.', 'Aku membersihkan {id} setiap hari.'],
            ['My sister has a new {w}.', 'Kakak perempuanku punya {id} baru.'], ['Please give me the {w}.', 'Tolong berikan {id} itu kepadaku.']],
        3: [['My mother put the {w} on the table.', 'Ibuku meletakkan {id} di atas meja.', { ex: ['table'] }],
            ['Can you help me find my {w}, please?', 'Bisakah kamu membantuku mencari {id} milikku?'],
            ["There is an old {w} in my grandmother's house.", 'Ada {id} tua di rumah nenekku.'],
            ['My father bought a new {w} for our house.', 'Ayahku membeli {id} baru untuk rumah kami.']]
      }
    },
    {
      id: 'school', name: 'Peralatan Sekolah', en: 'School Things', icon: '✏️',
      words: [
        ['pen', 'pulpen', '🖊️', 1], ['book', 'buku', '📕', 1], ['bag', 'tas', '🎒', 1],
        ['map', 'peta', '🗺️', 1], ['pin', 'paku payung', '📌', 1], ['paper', 'kertas', '📄', 1],
        ['pencil', 'pensil', '✏️', 1], ['ruler', 'penggaris', '📏', 1], ['desk', 'meja belajar', '', 1],
        ['glue', 'lem', '', 1],
        ['crayon', 'krayon', '🖍️', 2], ['eraser', 'penghapus', '', 2], ['scissors', 'gunting', '✂️', 2],
        ['notebook', 'buku catatan', '📓', 2], ['brush', 'kuas', '🖌️', 2], ['globe', 'bola dunia', '🌍', 2],
        ['clip', 'penjepit kertas', '📎', 2], ['chalk', 'kapur tulis', '', 2], ['board', 'papan tulis', '', 2],
        ['marker', 'spidol', '', 2],
        ['calculator', 'kalkulator', '', 3], ['dictionary', 'kamus', '📖', 3], ['sharpener', 'rautan', '', 3],
        ['compass', 'jangka', '', 3], ['uniform', 'seragam', '', 3], ['textbook', 'buku pelajaran', '📘', 3],
        ['stapler', 'stapler', '', 3], ['microscope', 'mikroskop', '🔬', 3], ['protractor', 'busur derajat', '', 3]
      ],
      sentences: {
        1: [['It is {a} {w}.', 'Itu adalah {id}.'], ['This is my {w}.', 'Ini {id} milikku.'],
            ['I have {a} {w}.', 'Aku punya {id}.'], ['Where is my {w}?', 'Di mana {id} milikku?']],
        2: [['I put my {w} in the bag.', 'Aku menaruh {id} di dalam tas.', { ex: ['bag'] }],
            ['Can I borrow your {w}?', 'Boleh aku pinjam {id} milikmu?'],
            ['My {w} is on the desk.', '{Id} milikku ada di atas meja.', { ex: ['desk'] }],
            ['I need a new {w}.', 'Aku butuh {id} baru.']],
        3: [['Please do not forget to bring your {w} tomorrow.', 'Tolong jangan lupa membawa {id} besok.'],
            ['I bought a new {w} at the bookstore yesterday.', 'Aku membeli {id} baru di toko buku kemarin.'],
            ['The teacher asked us to take out our {w}.', 'Guru meminta kami mengeluarkan {id}.'],
            ['My friend lent me his {w} during the test.', 'Temanku meminjamkan {id} miliknya saat ujian.']]
      }
    },
    {
      id: 'places', name: 'Nama Tempat', en: 'Places', icon: '🏫',
      words: [
        ['school', 'sekolah', '🏫', 1], ['park', 'taman', '⛲', 1], ['zoo', 'kebun binatang', '🦁', 1],
        ['bank', 'bank', '🏦', 1], ['farm', 'peternakan', '🚜', 1], ['shop', 'toko', '🏪', 1],
        ['beach', 'pantai', '🏖️', 1], ['city', 'kota', '🏙️', 1], ['sea', 'laut', '🌊', 1],
        ['river', 'sungai', '🏞️', 1],
        ['hotel', 'hotel', '🏨', 2], ['mosque', 'masjid', '🕌', 2], ['church', 'gereja', '⛪', 2],
        ['temple', 'kuil', '🛕', 2], ['market', 'pasar', '', 2], ['office', 'kantor', '🏢', 2],
        ['garden', 'kebun', '🌷', 2], ['island', 'pulau', '🏝️', 2], ['forest', 'hutan', '🌲', 2],
        ['castle', 'istana', '🏰', 2], ['village', 'desa', '🏘️', 2], ['mountain', 'gunung', '⛰️', 2],
        ['hospital', 'rumah sakit', '🏥', 3], ['library', 'perpustakaan', '📚', 3], ['museum', 'museum', '🏛️', 3],
        ['airport', 'bandara', '🛫', 3], ['station', 'stasiun', '🚉', 3], ['stadium', 'stadion', '🏟️', 3],
        ['restaurant', 'restoran', '🍜', 3], ['factory', 'pabrik', '🏭', 3], ['playground', 'taman bermain', '🎠', 3],
        ['supermarket', 'supermarket', '🛒', 3], ['bakery', 'toko roti', '🥐', 3], ['desert', 'gurun', '🏜️', 3]
      ],
      sentences: {
        1: [['This is {a} {w}.', 'Ini adalah {id}.'], ['I go to {t}.', 'Aku pergi ke {id}.'],
            ['I see {a} {w}.', 'Aku melihat {id}.'], ['Where is {t}?', 'Di mana {id}?']],
        2: [['We go to {t} today.', 'Kami pergi ke {id} hari ini.'], ['My house is near {t}.', 'Rumahku dekat dengan {id}.'],
            ['I like going to {t}.', 'Aku suka pergi ke {id}.'], ['My uncle lives near {t}.', 'Pamanku tinggal di dekat {id}.']],
        3: [['My family went to {t} last Sunday morning.', 'Keluargaku pergi ke {id} hari Minggu pagi yang lalu.'],
            ['Excuse me, how can I get to {t}?', 'Permisi, bagaimana caranya pergi ke {id}?'],
            ['There are many people at {t} this afternoon.', 'Ada banyak orang di {id} sore ini.'],
            ['We will visit {t} with our teacher tomorrow.', 'Kami akan mengunjungi {id} bersama guru besok.']]
      }
    },
    {
      id: 'verbs', name: 'Kata Kerja Sederhana', en: 'Simple Verbs', icon: '🏃',
      words: [
        ['eat', 'makan', '😋', 1], ['drink', 'minum', '🥤', 1], ['run', 'berlari', '🏃', 1],
        ['sit', 'duduk', '💺', 1], ['cry', 'menangis', '😭', 1], ['sing', 'bernyanyi', '🎤', 1],
        ['swim', 'berenang', '🏊', 1], ['read', 'membaca', '📖', 1], ['walk', 'berjalan', '🚶', 1],
        ['sleep', 'tidur', '😴', 1], ['jump', 'melompat', '🤸', 1], ['fly', 'terbang', '🕊️', 1],
        ['cook', 'memasak', '🍳', 1], ['play', 'bermain', '🎮', 1],
        ['write', 'menulis', '✍️', 2], ['dance', 'menari', '💃', 2], ['laugh', 'tertawa', '😂', 2],
        ['smile', 'tersenyum', '😊', 2], ['climb', 'memanjat', '🧗', 2], ['drive', 'mengemudi', '🚙', 2],
        ['ride', 'mengendarai sepeda', '🚴', 2], ['draw', 'menggambar', '🎨', 2], ['wash', 'mencuci', '🧼', 2],
        ['listen', 'mendengarkan', '👂', 2], ['look', 'melihat', '👀', 2], ['talk', 'berbicara', '🗣️', 2],
        ['sweep', 'menyapu', '🧹', 2], ['pray', 'berdoa', '🤲', 2], ['wave', 'melambaikan tangan', '👋', 2],
        ['kick', 'menendang', '🦵', 2], ['throw', 'melempar', '🤾', 2],
        ['study', 'belajar', '📝', 3], ['think', 'berpikir', '🤔', 3], ['clean', 'membersihkan', '🧽', 3],
        ['paint', 'mengecat', '🖌️', 3], ['whisper', 'berbisik', '🤫', 3], ['shout', 'berteriak', '📢', 3],
        ['open', 'membuka', '🔓', 3], ['close', 'menutup', '🔒', 3], ['sell', 'menjual', '🏷️', 3],
        ['teach', 'mengajar', '🧑‍🏫', 3], ['sneeze', 'bersin', '🤧', 3], ['yawn', 'menguap', '🥱', 3],
        ['travel', 'bepergian', '🧳', 3], ['celebrate', 'merayakan', '🎉', 3]
      ],
      sentences: {
        1: [['I can {w}.', 'Aku bisa {id}.'], ['We {w} now.', 'Kami {id} sekarang.'],
            ["Let's {w} together.", 'Ayo {id} bersama.'], ['They {w} here.', 'Mereka {id} di sini.']],
        2: [['I like to {w} every day.', 'Aku suka {id} setiap hari.'], ['They {w} in the morning.', 'Mereka {id} di pagi hari.'],
            ['Can you {w} with me?', 'Bisakah kamu {id} bersamaku?'], ['We do not {w} at night.', 'Kami tidak {id} di malam hari.']],
        3: [['My little brother does not want to {w} now.', 'Adik laki-lakiku tidak mau {id} sekarang.'],
            ['Every Sunday morning, my family and I {w} together.', 'Setiap Minggu pagi, aku dan keluargaku {id} bersama.'],
            ['I always {w} after I finish my homework.', 'Aku selalu {id} setelah menyelesaikan PR-ku.'],
            ['My friends and I like to {w} after school.', 'Aku dan teman-temanku suka {id} sepulang sekolah.']]
      }
    }
  ],

  // Tema "Campuran" otomatis mengambil kata & kalimat dari semua tema di atas.
  mixed: { id: 'mixed', name: 'Campuran', en: 'Mixed', icon: '🎲' },

  // Kata tempat yang tidak memakai "the" (contoh: I go to school).
  noThe: ['school'],

  levels: {
    1: { name: 'Mudah', en: 'Easy', icon: '🌱', count: 10 },
    2: { name: 'Sedang', en: 'Medium', icon: '🌿', count: 12 },
    3: { name: 'Sulit', en: 'Hard', icon: '🌳', count: 15 }
  }
};
