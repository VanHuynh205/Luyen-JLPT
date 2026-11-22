import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Types "../types/progress";

module {
  public type FlashcardStore = Map.Map<Principal, Map.Map<Text, Bool>>;
  public type KanjiStore = Map.Map<Principal, List.List<Types.KanjiQuizResult>>;
  public type GrammarStore = Map.Map<Principal, Set.Set<Text>>;
  public type ReadingStore = Map.Map<Principal, Map.Map<Text, Types.ReadingResult>>;

  // Content ids come from the client; bound them so one call cannot store arbitrary-size data.
  let maxIdSize = 128;
  let maxQuizTotal = 1000;

  func requireValidId(id : Text) {
    if (id.size() == 0 or id.size() > maxIdSize) Runtime.trap("Invalid content id");
  };

  func requireValidTotal(score : Nat, total : Nat) {
    if (score > total) Runtime.trap("Score cannot exceed total");
    if (total > maxQuizTotal) Runtime.trap("Total is too large");
  };

  public func setFlashcardStatus(self : FlashcardStore, user : Principal, cardId : Text, known : Bool) {
    requireValidId(cardId);
    switch (self.get(user)) {
      case (?cards) { cards.add(cardId, known) };
      case null {
        let cards = Map.empty<Text, Bool>();
        cards.add(cardId, known);
        self.add(user, cards);
      };
    };
  };

  public func flashcardStatuses(self : FlashcardStore, user : Principal) : [Types.FlashcardStatus] {
    switch (self.get(user)) {
      case (?cards) { cards.entries().map(func((cardId, known)) = { cardId; known }).toArray() };
      case null { [] };
    };
  };

  public func recordKanjiQuiz(
    self : KanjiStore,
    counter : Types.KanjiCounter,
    user : Principal,
    mode : Types.KanjiQuizMode,
    score : Nat,
    total : Nat,
    wrongItemIds : [Text],
  ) : Types.KanjiQuizResult {
    requireValidTotal(score, total);
    if (wrongItemIds.size() > total) Runtime.trap("Too many wrong items");
    for (id in wrongItemIds.values()) requireValidId(id);
    let result : Types.KanjiQuizResult = {
      id = counter.nextId;
      mode;
      score;
      total;
      wrongItemIds;
      takenAt = Time.now();
    };
    counter.nextId += 1;
    switch (self.get(user)) {
      case (?results) { results.add(result) };
      case null {
        let results = List.empty<Types.KanjiQuizResult>();
        results.add(result);
        self.add(user, results);
      };
    };
    result;
  };

  // Newest first; limit = null returns all
  public func kanjiHistory(self : KanjiStore, user : Principal, limit : ?Nat) : [Types.KanjiQuizResult] {
    switch (self.get(user)) {
      case (?results) {
        let newest = results.reverseValues();
        switch (limit) {
          case (?n) { newest.take(n).toArray() };
          case null { newest.toArray() };
        };
      };
      case null { [] };
    };
  };

  public func setGrammarLearned(self : GrammarStore, user : Principal, patternId : Text, learned : Bool) {
    requireValidId(patternId);
    switch (self.get(user)) {
      case (?ids) {
        if (learned) { ids.add(patternId) } else { ids.remove(patternId) };
      };
      case null {
        if (learned) {
          let ids = Set.empty<Text>();
          ids.add(patternId);
          self.add(user, ids);
        };
      };
    };
  };

  public func learnedGrammar(self : GrammarStore, user : Principal) : [Text] {
    switch (self.get(user)) {
      case (?ids) { ids.toArray() };
      case null { [] };
    };
  };

  public func recordReadingResult(self : ReadingStore, user : Principal, passageId : Text, score : Nat, total : Nat) : Types.ReadingResult {
    requireValidId(passageId);
    requireValidTotal(score, total);
    let passages = switch (self.get(user)) {
      case (?p) { p };
      case null {
        let p = Map.empty<Text, Types.ReadingResult>();
        self.add(user, p);
        p;
      };
    };
    let now = Time.now();
    let updated : Types.ReadingResult = switch (passages.get(passageId)) {
      case (?prev) {
        {
          passageId;
          attempts = prev.attempts + 1;
          lastScore = score;
          bestScore = if (score > prev.bestScore) score else prev.bestScore;
          total;
          lastAttemptAt = now;
        };
      };
      case null {
        {
          passageId;
          attempts = 1;
          lastScore = score;
          bestScore = score;
          total;
          lastAttemptAt = now;
        };
      };
    };
    passages.add(passageId, updated);
    updated;
  };

  public func readingResults(self : ReadingStore, user : Principal) : [Types.ReadingResult] {
    switch (self.get(user)) {
      case (?passages) { passages.values().toArray() };
      case null { [] };
    };
  };

  // ---- OQL row projections ----

  func modeText(mode : Types.KanjiQuizMode) : Text {
    switch (mode) {
      case (#single) { "single" };
      case (#compound) { "compound" };
      case (#mixed) { "mixed" };
    };
  };

  public func flashcardRows(self : FlashcardStore) : Iter.Iter<Types.FlashcardRow> {
    self.entries().flatMap(
      func((owner, cards)) = cards.entries().map(
        func((cardId, known)) = { key = owner.toText() # ":" # cardId; owner; cardId; known }
      )
    );
  };

  public func kanjiRows(self : KanjiStore) : Iter.Iter<Types.KanjiRow> {
    self.entries().flatMap(
      func((owner, results)) = results.values().map(
        func(r) = {
          id = r.id;
          owner;
          mode = modeText(r.mode);
          score = r.score;
          total = r.total;
          wrongItemIds = r.wrongItemIds.values().join(",");
          takenAt = r.takenAt;
        }
      )
    );
  };

  public func grammarRows(self : GrammarStore) : Iter.Iter<Types.GrammarRow> {
    self.entries().flatMap(
      func((owner, ids)) = ids.values().map(
        func(patternId) = { key = owner.toText() # ":" # patternId; owner; patternId }
      )
    );
  };

  public func readingRows(self : ReadingStore) : Iter.Iter<Types.ReadingRow> {
    self.entries().flatMap(
      func((owner, passages)) = passages.values().map(
        func(r) = {
          key = owner.toText() # ":" # r.passageId;
          owner;
          passageId = r.passageId;
          attempts = r.attempts;
          lastScore = r.lastScore;
          bestScore = r.bestScore;
          total = r.total;
          lastAttemptAt = r.lastAttemptAt;
        }
      )
    );
  };
};
