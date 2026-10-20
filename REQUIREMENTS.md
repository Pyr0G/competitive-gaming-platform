# OPIS POMYSŁU | WERSJA 1

## Platforma turniejowa
**Drużyny, szukanie graczy, czat i wyniki z FACEIT.**
Rankingi dorobimy później.

Co chcemy zbudować, jak to ma działać i w jakiej kolejności to zrobimy.
Chcemy zrobić miejsce, gdzie ludzie od gier mogą się zapisywać na turnieje drużynowo, szybko znaleźć brakującego gracza i pogadać ze sobą na czacie. Wynik meczu ma się wpisywać sam z linku do FACEIT, a nie ze screena. Rankingi i Elo są fajne, ale odkładamy je na później, bo bez ludzi na stronie i tak nie ma kogo w nich liczyć.

* **Konto w 5 sekund**
  Tylko nick i hasło. Bez maila, bez potwierdzania, bez kombinowania.
* **Szukam drużyny**
  Osobna tablica dla ludzi bez ekipy. Ogłaszasz się i czekasz, aż ktoś napisze.
* **Drużyny i zapisy**
  Zakładasz ekipę, wysyłasz znajomym kod i jednym kliknięciem zapisujesz się na turniej.
* **Wynik z linku**
  Po meczu wklejasz link z FACEIT, a strona sama pobiera wynik i przesuwa drabinkę.

### Nasz pomysł w kilku zdaniach
Kto grał w amatorskich turniejach, ten zna dwa problemy: ciągle komuś brakuje piątego gracza, a po meczu zaczynają się screeny i kłótnie o wynik.

Dlatego robimy stronę, na której gracz bez drużyny może się ogłosić i od razu pogadać z kapitanami na czacie. Po meczu wystarczy wkleić link do pokoju z FACEIT, a wynik wpisze się sam. Konto zakładasz w kilka sekund, bez maila. Rankingi dojdą, jak na stronie będzie już sporo ludzi.

*(Zdjęcia: Unsplash, Ikony: Twemoji.)*

---

## 1. Po co to robimy
Amatorskie turnieje rzadko padają przez samą grę. Zwykle sypie się organizacja. Ktoś ma czterech kumpli i brakuje piątego. Ktoś chce zagrać, ale nie ma z kim. Po meczu jedna drużyna wrzuca screen, druga mówi, że było inaczej, a admin siedzi i ręcznie poprawia drabinkę.

**Rzeczy, które najbardziej bolą i które chcemy załatwić od razu:**
* Brak pełnego składu przed turniejem i brak miejsca, gdzie można szybko kogoś znaleźć.
* Brak prostego sposobu, żeby się dogadać z obcą osobą bez wymieniania się Discordem na start.
* Ręczne wpisywanie wyników, screeny i kłótnie, kto naprawdę wygrał.
* Długie rejestracje z mailem i potwierdzaniem, które odstraszają ludzi chcących po prostu pograć.

> **Najważniejsza decyzja: rankingi później**
> Na start nie robimy Elo ani rankingów. Ranking ma sens dopiero wtedy, gdy na stronie są ludzie i rozegrane mecze, a na początku ich jeszcze nie będzie. Najpierw robimy rzeczy, które od razu się przydają: konta, drużyny, szukanie graczy, czat, zapisy i automatyczne wyniki. Taka pierwsza, najprostsza działająca wersja to nasze MVP.

### Robimy teraz
* Konta na nick i hasło
* Drużyny i zaproszenia kodem
* Tablica "szukam drużyny"
* Czat na żywo 1 na 1
* Turnieje, zapisy i drabinka
* Wynik meczu z linku FACEIT

### Dokładamy później
* Ranking graczy (Elo albo Glicko-2)
* Statystyki K/D, headshoty i inne
* Odznaki za turnieje
* Sezony i tabele
* Więcej gier i formatów
* Powiadomienia, bot na Discorda

---

## 2. Jak to wygląda oczami gracza
Weźmy przykład. Kuba chce zagrać w turnieju CS2, ale nie ma drużyny. Tak wygląda jego droga od wejścia na stronę do wyniku na drabince:

| Krok | Akcja | Opis |
| :--- | :--- | :--- |
| **1, 2** | **Zakłada konto i Uzupełnia profil** | Wpisuje nick i hasło. Po kilku sekundach jest zalogowany. Nie musi nic potwierdzać na mailu. Dopisuje swój nick z FACEIT, poziom, ulubioną rolę (np. entry albo support) i kiedy zwykle gra. |
| **3, 4** | **Wrzuca ogłoszenie i Dostaje wiadomość** | Na tablicy "szukam drużyny" pisze, że szuka ekipy na weekendowy turniej. Ola jest kapitanką drużyny, której brakuje piątego gracza. Widzi ogłoszenie, klika „Napisz" i gadają na czacie. |
| **5** | **Dołącza do drużyny** | Ola wysyła mu kod zaproszenia. Kuba go wpisuje i od razu jest w składzie. |
| **6** | **Drużyna zapisuje się na turniej** | Ola klika „Zapisz drużynę". Po zamknięciu zapisów strona losuje drabinkę. |
| **7** | **Grają mecz na FACEIT** | Mecz odbywa się normalnie na FACEIT, tak jak zawsze. |
| **8** | **Wklejają link** | Po meczu Ola wkleja link do pokoju meczu. Strona sama pobiera wynik, np. 13:10, i przesuwa zwycięzcę dalej. |

Każdy z tych kroków ma być prosty. Bez długich formularzy, bez screenów i bez czekania na admina.

---

## 3. Konta i logowanie
Logowanie ma być nieinwazyjne. Wchodzisz, wpisujesz nick i hasło i jesteś. Bez maila projekt jest lżejszy: nie trzeba wysyłać wiadomości, nie ma spamu, nie ma problemu "nie przyszedł mi mail".

**Jak to działa**
* **Rejestracja:** nick (musi być wolny), hasło i powtórzenie hasła. Tyle.
* **Logowanie:** nick i hasło. Strona pamięta, że jesteś zalogowany, więc nie musisz tego robić co chwilę.
* **Wylogowanie:** jeden przycisk.
* **Zmiana hasła:** w ustawieniach, po zalogowaniu.

**Bezpieczeństwo po ludzku**
* Hasła nie zapisujemy w bazie w normalnej postaci. Zamieniamy je na tak zwany hash (np. przez BCrypt). Nawet jak ktoś zajrzy do bazy, nie odczyta haseł. My też ich nie widzimy.
* Po zalogowaniu strona daje użytkownikowi token (np. JWT). To taka elektroniczna przepustka, dzięki której serwer wie, kto wysyła zapytanie.
* Limit prób logowania, żeby nikt nie mógł zgadywać haseł w kółko.

**Co jak ktoś zapomni hasła**
Bez maila nie ma klasycznego "przypomnij hasło". Na start są dwie proste opcje: przy rejestracji pokazujemy jednorazowy kod ratunkowy, który gracz może sobie zapisać, albo admin może ręcznie zresetować hasło. Wybierzemy jedną z nich w zespole.

**Co jest w profilu**
* Nick na naszej stronie.
* Nick albo konto FACEIT (potrzebne, żeby sprawdzać, kto grał w meczu).
* Poziom, ulubiona rola, kiedy zwykle gra, krótki opis.
* Drużyna, w której jest, i historia turniejów.

---

## 4. Drużyny i zaproszenia
Drużyna to podstawa, bo na turnieje zapisujemy się drużynowo. Zakładanie ekipy i wpuszczanie znajomych ma zająć chwilę.

**Zakładanie drużyny**
* Gracz klika „Załóż drużynę", wpisuje nazwę i krótki tag (np. 3-4 litery). Logo jest opcjonalne.
* Osoba, która zakłada drużynę, automatycznie zostaje kapitanem.
* Strona drużyny pokazuje skład, turnieje, w których grała, i wyniki.

**Zaproszenia**
* Kapitan dostaje unikalny kod (np. 6 znaków) albo link zaproszeniowy.
* Wysyła go znajomym gdziekolwiek: na Discordzie, Messengerze, na czacie u nas.
* Znajomy po kliknięciu albo wpisaniu kodu od razu wpada do składu.
* Jak kod gdzieś wycieknie, kapitan generuje nowy, a stary przestaje działać.

**Co może kapitan**
* Zapraszać i wyrzucać graczy.
* Przekazać kapitana komuś innemu.
* Zamknąć nabór, kiedy skład jest pełny.
* Zapisywać drużynę na turnieje i wklejać linki do meczów.

**Proste zasady**
* Skład to 5 graczy podstawowych plus np. do 2 rezerwowych.
* Jeden gracz nie może grać w dwóch drużynach w tym samym turnieju.

---

## 5. Strefa "szukam drużyny"
To osobny pokój dla ludzi, którzy nie mają ekipy, i dla drużyn, którym kogoś brakuje. W branży mówi się na to LFG, czyli Looking for Group. Ma działać jak tablica ogłoszeń.

**Dwa rodzaje ogłoszeń**
* **Gracz szuka drużyny:** „Mam poziom 7 na FACEIT, gram support, szukam ekipy na weekendy".
* **Drużyna szuka gracza:** „Brakuje nam piątego na entry, gramy wieczorami".

**Co jest w ogłoszeniu**
* Gra (na start CS2).
* Poziom albo ranga, np. poziom FACEIT od 1 do 10.
* Rola, np. entry, support, AWP, IGL albo "gram wszystko".
* Kiedy gra: wieczory, weekendy, konkretne dni.
* Język i krótki opis od siebie.

**Jak to działa na co dzień**
* Ogłoszenia widać na wspólnej liście. Można je filtrować po roli, poziomie i porze grania.
* Przy każdym ogłoszeniu jest przycisk „Napisz", który otwiera czat.
* Ogłoszenie samo znika po np. 7 dniach, żeby tablica nie zarosła starymi wpisami. Można je odświeżyć jednym kliknięciem.
* Jak ktoś już znajdzie drużynę, zamyka ogłoszenie.

---

## 6. Czat na żywo
Czat jest po to, żeby dwie osoby mogły się dogadać bez wymieniania się kontaktami na start. Wiadomości mają przychodzić od razu, bez odświeżania strony.

**Co ma umieć na start**
* Rozmowy 1 na 1, otwierane z ogłoszenia albo z profilu gracza.
* Lista rozmów z zaznaczonymi nieprzeczytanymi wiadomościami.
* Historia rozmowy zostaje po odświeżeniu strony i po ponownym zalogowaniu.
* Możliwość zablokowania i zgłoszenia kogoś, kto spamuje albo jest toksyczny.

**Jak to działa od środka (w prostych słowach)**
Zwykła strona działa tak, że przeglądarka pyta serwer o coś i dostaje odpowiedź. Przy czacie to za mało, bo serwer musi sam dać znać, że przyszła nowa wiadomość. Do tego służą WebSockety, czyli stale otwarte połączenie między przeglądarką a serwerem. Gotowe narzędzia do tego to Socket.io (jeśli backend będzie w Node.js) albo SignalR (jeśli w C# i .NET). Wiadomości dodatkowo zapisujemy w bazie, żeby nie znikały.

**Na później**
* Czat całej drużyny.
* Czat meczu, gdzie dwie drużyny i admin ustalają godzinę grania.
* Przycisk „Zaproś do drużyny" prosto z okna rozmowy.

> **Dlaczego czat jest dla nas ważny**
> Dzięki szukaniu graczy i czatowi to nie jest kolejna strona z formularzem zapisów. Ludzie mogą się tu poznać, dogadać i złożyć drużynę bez wychodzenia ze strony.

---

## 7. Turnieje i drabinka

**Zakładanie turnieju**
* Admin podaje nazwę, grę, datę, liczbę miejsc (np. 8 albo 16 drużyn) i format meczów (BO1 albo BO3).
* Może dopisać krótki regulamin: mapy, godziny, co jak drużyna się nie pojawi.

**Zapisy**
* Kapitan klika „Zapisz drużynę". Strona sprawdza, czy skład jest pełny.
* Widać listę zapisanych drużyn i ile miejsc zostało.
* Admin zamyka zapisy ręcznie albo zamykają się same o ustalonej godzinie.

**Drabinka**
* Po zamknięciu zapisów strona losuje pary i rysuje drabinkę.
* Na start system pucharowy (single elimination): przegrywasz i odpadasz.
* Jak drużyn jest mniej niż miejsc, część dostaje wolny los i od razu przechodzi dalej.
* Każdy mecz ma swój status: zaplanowany, do rozegrania, czeka na wynik, zakończony albo sporny.

---

## 8. Wynik meczu z linku FACEIT
To nasz najciekawszy kawałek. Zamiast pola "wpisz wynik" jest pole "wklej link do meczu z FACEIT". Resztę robi strona.

**Co się dzieje po wklejeniu linku**
1. **Strona wyciąga ID meczu:** Link do pokoju na FACEIT zawiera unikalny numer meczu. Strona wycina go z linku.
2. **Pyta FACEIT o ten mecz:** FACEIT ma publiczne API dla twórców stron. Klucz do niego jest darmowy, trzeba tylko założyć konto developera.
3. **Sprawdza, czy mecz jest skończony:** Jeśli mecz jeszcze trwa, strona prosi, żeby spróbować za chwilę.
4. **Sprawdza, kto grał:** Porównuje graczy z meczu z nickami FACEIT w profilach obu naszych drużyn. Dzięki temu nikt nie wklei linku z innego meczu.
5. **Zapisuje wynik i przesuwa drabinkę:** Bierze wynik i zwycięzcę, wpisuje go do meczu, a zwycięska drużyna automatycznie przechodzi dalej.

**Co jak coś pójdzie nie tak**
* **Zły link:** strona od razu pokazuje komunikat, że to nie jest link do meczu FACEIT.
* **Gracze się nie zgadzają:** mecz dostaje status "sporny" i trafia do admina.
* **Ten sam link drugi raz:** strona go odrzuca, jeden mecz FACEIT to jeden mecz u nas.
* **FACEIT nie odpowiada:** admin ma awaryjny przycisk do ręcznego wpisania wyniku.

> **Zero screenów, czysta automatyzacja**
> Wynik bierzemy prosto ze źródła, więc nie ma o co się kłócić, a admin nie musi niczego przepisywać. Gracz robi tylko jedną rzecz: wkleja link. Całą resztę, czyli sprawdzenie meczu, wpisanie wyniku i przesunięcie drabinki, robi strona.

---

## 9. Plan pracy krok po kroku
Robimy wszystko po kolei. Każdy etap ma jasno opisane, kiedy uznajemy go za skończony, żeby nie było wiecznego "prawie działa".

| Etap | Co robimy | Gotowe, kiedy |
| :--- | :--- | :--- |
| **Etap 0: ustalenia** | Wybieramy język i narzędzia do backendu (pod FACEIT API i czat), rysujemy bazę danych, dzielimy się robotą. | Wszyscy wiedzą, w czym piszemy i kto co robi. Rysunek bazy jest gotowy. |
| **Etap 1: konta i drużyny** | Rejestracja, logowanie, profil, zakładanie drużyny, kody zaproszeń. | Da się założyć konto, zrobić drużynę i wpuścić do niej znajomego kodem. |
| **Etap 2: szukanie graczy i czat** | Tablica ogłoszeń z filtrami, czat 1 na 1 na żywo, blokowanie i zgłaszanie. | Ktoś bez drużyny wrzuca ogłoszenie, kapitan do niego pisze i rozmowa leci bez odświeżania. |
| **Etap 3: turnieje i FACEIT** | Zakładanie turnieju, zapisy, losowanie drabinki, wynik z linku FACEIT, panel admina. | Testowy turniej na 8 drużyn przechodzi od zapisów do finału, a wyniki wchodzą z linków. |
| **Etap 4: wdrożenie** | Wrzucamy stronę do internetu i dajemy ją znajomym do testów. | Strona działa pod publicznym adresem, a pierwsi ludzie z niej korzystają. |

**Co będzie w bazie danych**

| Tabela | Co w niej trzymamy |
| :--- | :--- |
| **Users** | Nick, zahashowane hasło, nick FACEIT, poziom, rola, opis, data założenia konta. |
| **Teams** | Nazwa, tag, kapitan, kod zaproszenia, czy nabór jest otwarty. |
| **TeamMembers** | Kto jest w jakiej drużynie i czy jest w podstawie, czy rezerwowym. |
| **Advertisements** | Ogłoszenia z tablicy: kto, czego szuka, poziom, rola, kiedy gra, do kiedy ważne. |
| **Conversations i Messages** | Rozmowy na czacie i wiadomości: kto, do kogo, treść, kiedy, czy przeczytane. |
| **Tournaments** | Nazwa, gra, data, liczba miejsc, format, status zapisów. |
| **Matches** | Kto z kim gra, który etap drabinki, wynik, link FACEIT, status meczu. |

**Wrzucenie strony do internetu**
* **Baza danych:** darmowy hosting na start, np. Supabase albo Neon.
* **Backend:** VPS albo Render. Ważne, żeby hosting obsługiwał WebSockety, bo bez nich nie ruszy czat.
* **Frontend:** Vercel albo Netlify.

---

## 10. Plan na przyszłą rozbudowę
To, co opisaliśmy wyżej, to pierwsza wersja. Jak strona się rozkręci, dokładamy rzeczy, które mają sens dopiero przy większej liczbie ludzi i meczów.

* **Ranking graczy i drużyn.** Elo albo Glicko-2 to systemy, które po każdym meczu dodają lub odejmują punkty. Wygrana z mocniejszym daje więcej punktów, przegrana ze słabszym zabiera więcej.
* **Statystyki z FACEIT.** K/D, procent headshotów, najlepsze mapy, MVP meczu.
* **Odznaki.** Za pierwszy turniej, za wygraną, za serię zwycięstw.
* **Sezony.** Ranking resetowany co jakiś czas, żeby każdy miał szansę.
* **Więcej formatów.** Faza grupowa, drabinka z drugą szansą (double elimination).
* **Więcej gier.** Np. Valorant albo League of Legends, jeśli będą chętni.
* **Wygoda.** Powiadomienia, bot na Discorda, logowanie przez Steam albo FACEIT jako dodatkowa opcja.

---

## 11. Rzeczy do przemyślenia
Kilka rzeczy, które mogą sprawić problem i jak chcemy je rozwiązać.

* **Multikonta.** Bez maila łatwo założyć kilka kont. Pomoże limit kont na jeden adres IP albo przypięcie konta FACEIT do jednego profilu.
* **Trolle na czacie.** Dlatego od początku jest blokowanie i zgłaszanie.
* **Zmiany nicków na FACEIT.** Lepiej zapisywać stały identyfikator gracza z FACEIT, a nie sam nick, bo nick można zmienić.
* **Limity API.** FACEIT ogranicza liczbę zapytań. Przy amatorskich turniejach to nie problem, ale warto o tym wiedzieć.
* **Mecze poza FACEIT.** Jak ktoś zagra gdzie indziej, zostaje ręczne wpisanie wyniku przez admina.

---

## 12. Słowniczek
Kilka pojęć, które pojawiają się w tym dokumencie:

| Pojęcie | Co to znaczy |
| :--- | :--- |
| **MVP** | Najmniejsza wersja produktu, która już działa i da się jej używać. |
| **LFG** | Looking for Group, czyli "szukam drużyny". |
| **API** | Sposób, w jaki nasza strona może pytać inną usługę (tu FACEIT) o dane. |
| **WebSocket** | Stale otwarte połączenie, dzięki któremu wiadomości przychodzą od razu. |
| **Hash hasła** | Zaszyfrowana postać hasła, z której nie da się odczytać oryginału. |
| **Token (JWT)** | Elektroniczna przepustka, dzięki której serwer wie, kto jest zalogowany. |
| **Drabinka** | Rozpiska meczów w turnieju, kto z kim gra i kto przechodzi dalej. |
| **BO1, BO3** | Mecz do jednej wygranej mapy albo do dwóch wygranych z trzech. |
| **Elo** | System punktów, który po każdym meczu ocenia, jak mocny jest gracz albo drużyna. |

**Co robimy dalej**
1. Ustalamy w zespole ostateczną listę funkcji na start.
2. Wybieramy język i narzędzia do backendu.
3. Rysujemy bazę danych.
4. Dzielimy się robotą i dopiero wtedy zaczynamy programować.