import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";

module {
  type KanjiQuizMode = { #single; #compound; #mixed };

  type KanjiQuizResult = {
    id : Nat;
    mode : KanjiQuizMode;
    score : Nat;
    total : Nat;
    wrongItemIds : [Text];
    takenAt : Int;
  };

  type ReadingResult = {
    passageId : Text;
    attempts : Nat;
    lastScore : Nat;
    bestScore : Nat;
    total : Nat;
    lastAttemptAt : Int;
  };

  public type OldActor = {};
  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    flashcardStatuses : Map.Map<Principal, Map.Map<Text, Bool>>;
    kanjiResults : Map.Map<Principal, List.List<KanjiQuizResult>>;
    kanjiCounter : { var nextId : Nat };
    learnedGrammar : Map.Map<Principal, Set.Set<Text>>;
    readingResults : Map.Map<Principal, Map.Map<Text, ReadingResult>>;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      flashcardStatuses = Map.empty();
      kanjiResults = Map.empty();
      kanjiCounter = { var nextId = 0 };
      learnedGrammar = Map.empty();
      readingResults = Map.empty();
    };
  };
};
