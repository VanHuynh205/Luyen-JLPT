import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import OQL "mo:caffeineai-oql";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import TextValue "mo:caffeineai-oql/TextValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import ProgressTypes "types/progress";
import ProgressLib "lib/progress";
import ProgressApi "mixins/progress-api";
import ApiDocMixin "mixins/api-doc";

actor {
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);

  let flashcardStatuses : Map.Map<Principal, Map.Map<Text, Bool>>;
  let kanjiResults : Map.Map<Principal, List.List<ProgressTypes.KanjiQuizResult>>;
  let kanjiCounter : ProgressTypes.KanjiCounter;
  let learnedGrammar : Map.Map<Principal, Set.Set<Text>>;
  let readingResults : Map.Map<Principal, Map.Map<Text, ProgressTypes.ReadingResult>>;
  include ProgressApi(flashcardStatuses, kanjiResults, kanjiCounter, learnedGrammar, readingResults);

  include ApiDocMixin();

  transient let anyP = Principal.fromText("aaaaa-aa");

  include Expose({
    entities = [
      OQL.Entity.new<ProgressTypes.FlashcardRow>("flashcard", func() = flashcardStatuses.flashcardRows(), "Flashcard", "key")
        .sample({ key = ""; owner = anyP; cardId = ""; known = false })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<ProgressTypes.KanjiRow>("kanjiResult", func() = kanjiResults.kanjiRows(), "KanjiResult", "id")
        .sample({ id = 0; owner = anyP; mode = ""; score = 0; total = 0; wrongItemIds = ""; takenAt = 0 })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<ProgressTypes.GrammarRow>("learnedGrammar", func() = learnedGrammar.grammarRows(), "LearnedGrammar", "key")
        .sample({ key = ""; owner = anyP; patternId = "" })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<ProgressTypes.ReadingRow>("readingResult", func() = readingResults.readingRows(), "ReadingResult", "key")
        .sample({ key = ""; owner = anyP; passageId = ""; attempts = 0; lastScore = 0; bestScore = 0; total = 0; lastAttemptAt = 0 })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
    ];
  });
};
