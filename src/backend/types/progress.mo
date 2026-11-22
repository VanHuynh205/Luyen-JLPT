module {
  // Nanoseconds since epoch, from Time.now()
  public type Timestamp = Int;

  public type FlashcardStatus = {
    cardId : Text;
    known : Bool;
  };

  public type KanjiQuizMode = {
    #single;
    #compound;
    #mixed;
  };

  public type KanjiQuizResult = {
    id : Nat;
    mode : KanjiQuizMode;
    score : Nat;
    total : Nat;
    wrongItemIds : [Text];
    takenAt : Timestamp;
  };

  public type ReadingResult = {
    passageId : Text;
    attempts : Nat;
    lastScore : Nat;
    bestScore : Nat;
    total : Nat;
    lastAttemptAt : Timestamp;
  };

  public type ProgressSummary = {
    knownFlashcardCount : Nat;
    flashcards : [FlashcardStatus];
    recentKanjiResults : [KanjiQuizResult];
    learnedGrammarIds : [Text];
    readingResults : [ReadingResult];
  };

  public type KanjiCounter = { var nextId : Nat };

  // Flat OQL row projections (owner promoted from the outer map key)
  public type FlashcardRow = { key : Text; owner : Principal; cardId : Text; known : Bool };
  public type KanjiRow = {
    id : Nat;
    owner : Principal;
    mode : Text;
    score : Nat;
    total : Nat;
    wrongItemIds : Text;
    takenAt : Int;
  };
  public type GrammarRow = { key : Text; owner : Principal; patternId : Text };
  public type ReadingRow = {
    key : Text;
    owner : Principal;
    passageId : Text;
    attempts : Nat;
    lastScore : Nat;
    bestScore : Nat;
    total : Nat;
    lastAttemptAt : Int;
  };
};
