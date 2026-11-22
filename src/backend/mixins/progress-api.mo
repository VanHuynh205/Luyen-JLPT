import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../types/progress";
import ProgressLib "../lib/progress";

mixin (
  flashcardStatuses : Map.Map<Principal, Map.Map<Text, Bool>>,
  kanjiResults : Map.Map<Principal, List.List<Types.KanjiQuizResult>>,
  kanjiCounter : Types.KanjiCounter,
  learnedGrammar : Map.Map<Principal, Set.Set<Text>>,
  readingResults : Map.Map<Principal, Map.Map<Text, Types.ReadingResult>>,
) {
  public shared ({ caller }) func setFlashcardStatus(cardId : Text, known : Bool) : async () {
    if (caller.isAnonymous()) Runtime.trap("Please sign in to save progress");
    flashcardStatuses.setFlashcardStatus(caller, cardId, known);
  };

  public shared query ({ caller }) func getMyFlashcardStatuses() : async [Types.FlashcardStatus] {
    if (caller.isAnonymous()) return [];
    flashcardStatuses.flashcardStatuses(caller);
  };

  public shared ({ caller }) func recordKanjiQuiz(mode : Types.KanjiQuizMode, score : Nat, total : Nat, wrongItemIds : [Text]) : async Types.KanjiQuizResult {
    if (caller.isAnonymous()) Runtime.trap("Please sign in to save progress");
    kanjiResults.recordKanjiQuiz(kanjiCounter, caller, mode, score, total, wrongItemIds);
  };

  public shared query ({ caller }) func getMyKanjiHistory() : async [Types.KanjiQuizResult] {
    if (caller.isAnonymous()) return [];
    kanjiResults.kanjiHistory(caller, null);
  };

  public shared ({ caller }) func setGrammarLearned(patternId : Text, learned : Bool) : async () {
    if (caller.isAnonymous()) Runtime.trap("Please sign in to save progress");
    learnedGrammar.setGrammarLearned(caller, patternId, learned);
  };

  public shared query ({ caller }) func getMyLearnedGrammar() : async [Text] {
    if (caller.isAnonymous()) return [];
    learnedGrammar.learnedGrammar(caller);
  };

  public shared ({ caller }) func recordReadingResult(passageId : Text, score : Nat, total : Nat) : async Types.ReadingResult {
    if (caller.isAnonymous()) Runtime.trap("Please sign in to save progress");
    readingResults.recordReadingResult(caller, passageId, score, total);
  };

  public shared query ({ caller }) func getMyReadingResults() : async [Types.ReadingResult] {
    if (caller.isAnonymous()) return [];
    readingResults.readingResults(caller);
  };

  public shared query ({ caller }) func getMyProgress() : async Types.ProgressSummary {
    if (caller.isAnonymous()) {
      return {
        knownFlashcardCount = 0;
        flashcards = [];
        recentKanjiResults = [];
        learnedGrammarIds = [];
        readingResults = [];
      };
    };
    let flashcards = flashcardStatuses.flashcardStatuses(caller);
    {
      knownFlashcardCount = flashcards.filter(func f = f.known).size();
      flashcards;
      recentKanjiResults = kanjiResults.kanjiHistory(caller, ?10);
      learnedGrammarIds = learnedGrammar.learnedGrammar(caller);
      readingResults = readingResults.readingResults(caller);
    };
  };
};
