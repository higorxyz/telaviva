import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FaChevronLeft,
  FaChevronRight,
  FaHome,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
} from 'react-icons/fa';
import {
  fetchPersonDetails,
  fetchPersonImages,
  fetchPersonMovieCredits,
} from '../api';
import PageSEO from '../../../components/seo/PageSEO';

const BIOGRAPHY_PREVIEW_LIMIT = 520;
const KNOWN_FOR_LIMIT = 8;
const NAV_BUTTON_BASE_CLASS =
  'inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-300 md:px-8 md:py-3 md:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const NAV_PRIMARY_BUTTON_CLASS =
  `${NAV_BUTTON_BASE_CLASS} group border border-neutral-700 bg-black text-gray-100 shadow-[0_18px_34px_-24px_rgba(0,0,0,0.85)] hover:bg-black focus-visible:ring-tv-accent/45`;
const NAV_SECONDARY_BUTTON_CLASS =
  `${NAV_BUTTON_BASE_CLASS} border border-neutral-700 bg-neutral-900/85 text-gray-100 shadow-[0_18px_34px_-24px_rgba(0,0,0,0.85)] hover:border-neutral-500 hover:bg-neutral-800/90 focus-visible:ring-neutral-500/60`;
const CAROUSEL_ARROW_BASE_CLASS =
  'hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full border border-neutral-700/80 bg-black/75 text-gray-200 shadow-lg backdrop-blur-sm transition-colors duration-200 hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60';
const CAROUSEL_LEFT_ARROW_CLASS = `${CAROUSEL_ARROW_BASE_CLASS} left-0 -translate-x-4`;
const CAROUSEL_RIGHT_ARROW_CLASS = `${CAROUSEL_ARROW_BASE_CLASS} right-0 translate-x-4`;
const DEPARTMENT_LABELS = {
  acting: 'Atuação',
  directing: 'Direção',
  production: 'Produção',
  writing: 'Roteiro',
  camera: 'Fotografia',
  editing: 'Edição',
  sound: 'Som',
  'visual effects': 'Efeitos visuais',
  art: 'Arte',
  'costume & make-up': 'Figurino e maquiagem',
  crew: 'Equipe técnica',
  lighting: 'Iluminação',
};
const CREW_JOB_LABELS = {
  director: 'Direção',
  producer: 'Produção',
  'executive producer': 'Produção executiva',
  writer: 'Roteiro',
  screenplay: 'Roteiro',
  story: 'História',
  editor: 'Edição',
  cinematography: 'Fotografia',
  'director of photography': 'Fotografia',
  composer: 'Trilha sonora',
  'original music composer': 'Trilha sonora',
  'production design': 'Direção de arte',
  costume: 'Figurino',
  'costume design': 'Figurino',
  'visual effects': 'Efeitos visuais',
};

const buildTmdbImageUrl = (path, size = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

const parseReleaseDate = (rawDate) => {
  if (!rawDate) {
    return null;
  }

  if (rawDate instanceof Date) {
    if (Number.isNaN(rawDate.getTime())) {
      return null;
    }

    return new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
  }

  if (typeof rawDate !== 'string') {
    return null;
  }

  const parsedDate = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const getReleaseTimestamp = (rawDate) => {
  const parsedDate = parseReleaseDate(rawDate);
  return parsedDate ? parsedDate.getTime() : 0;
};

const getReleaseYear = (rawDate) => {
  const parsedDate = parseReleaseDate(rawDate);
  return parsedDate ? String(parsedDate.getFullYear()) : '-';
};

const formatDateForDetails = (rawDate) => {
  if (!rawDate) {
    return null;
  }

  const parsedDate = parseReleaseDate(rawDate);
  if (!parsedDate) {
    return null;
  }

  return parsedDate.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const calculateAge = (birthDate, referenceDate = new Date()) => {
  const birth = parseReleaseDate(birthDate);
  const reference = parseReleaseDate(referenceDate);

  if (!birth || !reference) {
    return null;
  }

  let age = reference.getFullYear() - birth.getFullYear();
  const monthDifference = reference.getMonth() - birth.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && reference.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const getBirthDetails = (birthday, deathday) => {
  const formattedBirthDate = formatDateForDetails(birthday);
  if (!formattedBirthDate) {
    return 'Não informado';
  }

  const age = deathday ? calculateAge(birthday, deathday) : calculateAge(birthday);
  if (age == null) {
    return formattedBirthDate;
  }

  return `${formattedBirthDate} (${age} de idade)`;
};

const getGenderLabel = (gender) => {
  const normalizedGender = Number(gender);

  if (normalizedGender === 1) {
    return 'Feminino';
  }

  if (normalizedGender === 2) {
    return 'Masculino';
  }

  if (normalizedGender === 3) {
    return 'Não binário';
  }

  return 'Não informado';
};

const getAlsoKnownAs = (aliases = []) => {
  if (!Array.isArray(aliases)) {
    return 'Não informado';
  }

  const normalizedAliases = aliases
    .map((alias) => (typeof alias === 'string' ? alias.trim() : ''))
    .filter(Boolean);

  if (normalizedAliases.length === 0) {
    return 'Não informado';
  }

  return normalizedAliases.slice(0, 2).join(', ');
};

const getDepartmentLabel = (department) => {
  if (typeof department !== 'string' || !department.trim()) {
    return 'Não informado';
  }

  const normalizedDepartment = department.trim().toLowerCase();
  return DEPARTMENT_LABELS[normalizedDepartment] ?? department.trim();
};

const getCrewRoleLabel = (credit) => {
  const normalizedJob = typeof credit?.job === 'string' ? credit.job.trim().toLowerCase() : '';

  if (normalizedJob) {
    return CREW_JOB_LABELS[normalizedJob] ?? credit.job.trim();
  }

  return getDepartmentLabel(credit?.department);
};

const getCastRoleLabel = (credit) => {
  if (typeof credit?.character === 'string' && credit.character.trim()) {
    return `como ${credit.character.trim()}`;
  }

  return 'como elenco';
};

const getKnownForLabel = (gender) => {
  const normalizedGender = Number(gender);

  if (normalizedGender === 1) {
    return 'Conhecida por';
  }

  if (normalizedGender === 2) {
    return 'Conhecido por';
  }

  return 'Conhecido(a) por';
};

const getCreditOrder = (credit) => {
  const parsedOrder = Number(credit?.order);
  return Number.isFinite(parsedOrder) ? parsedOrder : Number.POSITIVE_INFINITY;
};

const compareCreditsByRelevance = (firstCredit, secondCredit) => {
  const orderDifference = getCreditOrder(firstCredit) - getCreditOrder(secondCredit);
  if (orderDifference !== 0) {
    return orderDifference;
  }

  const popularityDifference = Number(secondCredit?.popularity ?? 0) - Number(firstCredit?.popularity ?? 0);
  if (popularityDifference !== 0) {
    return popularityDifference;
  }

  const voteCountDifference = Number(secondCredit?.vote_count ?? 0) - Number(firstCredit?.vote_count ?? 0);
  if (voteCountDifference !== 0) {
    return voteCountDifference;
  }

  const releaseDateDifference =
    getReleaseTimestamp(secondCredit?.release_date) - getReleaseTimestamp(firstCredit?.release_date);
  if (releaseDateDifference !== 0) {
    return releaseDateDifference;
  }

  return String(firstCredit?.title ?? '').localeCompare(String(secondCredit?.title ?? ''), 'pt-BR');
};

const compareCreditsByTimeline = (firstCredit, secondCredit) => {
  const releaseDateDifference =
    getReleaseTimestamp(secondCredit?.release_date) - getReleaseTimestamp(firstCredit?.release_date);

  if (releaseDateDifference !== 0) {
    return releaseDateDifference;
  }

  return compareCreditsByRelevance(firstCredit, secondCredit);
};

const dedupeCreditsByMovie = (credits = []) => {
  const dedupedByMovieId = new Map();

  credits.forEach((credit) => {
    if (!credit?.id) {
      return;
    }

    const previousCredit = dedupedByMovieId.get(credit.id);
    if (!previousCredit || compareCreditsByRelevance(credit, previousCredit) < 0) {
      dedupedByMovieId.set(credit.id, credit);
    }
  });

  return Array.from(dedupedByMovieId.values());
};

const useHorizontalCarousel = (items = []) => {
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const dragStartXRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const shouldSuppressClickRef = useRef(false);

  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return undefined;
    }

    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = carouselElement;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    };

    updateScrollState();
    carouselElement.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      carouselElement.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items]);

  const handleScroll = (direction) => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return;
    }

    carouselElement.scrollBy({
      left: direction === 'left' ? -280 : 280,
      behavior: 'smooth',
    });
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragStartXRef.current = event.clientX;
    dragDistanceRef.current = 0;
    shouldSuppressClickRef.current = false;

    const currentRef = carouselRef.current;
    if (!currentRef) {
      return;
    }

    const initialScrollLeft = currentRef.scrollLeft;

    const handleMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - dragStartXRef.current;
      const movement = Math.abs(x);

      if (movement > dragDistanceRef.current) {
        dragDistanceRef.current = movement;
      }

      if (dragDistanceRef.current > 6) {
        shouldSuppressClickRef.current = true;
      }

      if (carouselRef.current) {
        carouselRef.current.scrollLeft = initialScrollLeft - x;
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (carouselRef.current) {
        carouselRef.current.style.cursor = 'grab';
      }

      window.setTimeout(() => {
        shouldSuppressClickRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    currentRef.style.cursor = 'grabbing';
  };

  const handleClickCapture = (event) => {
    if (!shouldSuppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return {
    carouselRef,
    canScrollLeft,
    canScrollRight,
    handleScroll,
    handleMouseDown,
    handleClickCapture,
  };
};

const KnownForStarRating = ({ voteAverage }) => {
  const normalizedVoteAverage = Number(voteAverage);
  if (!Number.isFinite(normalizedVoteAverage) || normalizedVoteAverage <= 0) {
    return <span className="text-[11px] text-gray-300">Avaliação indisponível</span>;
  }

  const rating = normalizedVoteAverage / 2;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" aria-label={`Avaliação ${rating.toFixed(1)} de 5`}>
      {Array.from({ length: fullStars }, (_, index) => (
        <FaStar key={`known-for-full-${index}`} className="text-yellow-400" size={12} />
      ))}

      {hasHalfStar ? <FaStarHalfAlt className="text-yellow-400" size={12} /> : null}

      {Array.from({ length: emptyStars }, (_, index) => (
        <FaRegStar key={`known-for-empty-${index}`} className="text-yellow-400" size={12} />
      ))}

      <span className="ml-1 text-[11px] font-semibold text-white">{rating.toFixed(1)}</span>
    </div>
  );
};

const PersonProfileSkeleton = () => (
  <div className="min-h-screen bg-black text-white pt-24 pb-10" role="status" aria-label="Carregando perfil de pessoa">
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 animate-pulse space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <div className="aspect-[2/3] w-full rounded-2xl bg-neutral-800" />

        <div className="space-y-4">
          <div className="h-4 w-20 rounded bg-neutral-800" />
          <div className="h-10 w-3/4 rounded bg-neutral-800" />
          <div className="flex flex-wrap gap-2">
            <div className="h-7 w-32 rounded-full bg-neutral-800" />
            <div className="h-7 w-44 rounded-full bg-neutral-800" />
            <div className="h-7 w-28 rounded-full bg-neutral-800" />
          </div>
          <div className="h-4 w-24 rounded bg-neutral-800" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-neutral-800" />
            <div className="h-4 rounded bg-neutral-800" />
            <div className="h-4 w-5/6 rounded bg-neutral-800" />
            <div className="h-4 w-4/6 rounded bg-neutral-800" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={`person-movie-skeleton-${index}`} className="rounded-xl bg-neutral-800 p-2">
            <div className="aspect-[2/3] w-full rounded-lg bg-neutral-700" />
            <div className="mt-2 h-3 w-5/6 rounded bg-neutral-700" />
            <div className="mt-1 h-3 w-3/5 rounded bg-neutral-700" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PersonProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isBiographyExpanded, setIsBiographyExpanded] = useState(false);

  const {
    data: person,
    isLoading: isPersonLoading,
    error: personError,
  } = useQuery({
    queryKey: ['person', id, 'details'],
    queryFn: () => fetchPersonDetails(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
  });

  const {
    data: personCredits,
    isLoading: isCreditsLoading,
    error: creditsError,
  } = useQuery({
    queryKey: ['person', id, 'movie-credits'],
    queryFn: () => fetchPersonMovieCredits(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
  });

  const { data: personImages = [] } = useQuery({
    queryKey: ['person', id, 'images'],
    queryFn: () => fetchPersonImages(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const isLoading = isPersonLoading || isCreditsLoading;
  const pageError = personError || creditsError;

  const castMovies = useMemo(() => {
    const castCredits = Array.isArray(personCredits?.cast) ? personCredits.cast : [];
    return dedupeCreditsByMovie(castCredits);
  }, [personCredits]);

  const crewMovies = useMemo(() => {
    const crewCredits = Array.isArray(personCredits?.crew) ? personCredits.crew : [];
    return dedupeCreditsByMovie(crewCredits);
  }, [personCredits]);

  const additionalParticipationRoles = useMemo(() => {
    const crewCredits = Array.isArray(personCredits?.crew) ? personCredits.crew : [];

    if (crewCredits.length === 0) {
      return 'Não informado';
    }

    const roleFrequency = new Map();

    crewCredits.forEach((credit) => {
      const roleLabel = getCrewRoleLabel(credit);

      if (!roleLabel || roleLabel === 'Não informado') {
        return;
      }

      roleFrequency.set(roleLabel, (roleFrequency.get(roleLabel) ?? 0) + 1);
    });

    if (roleFrequency.size === 0) {
      return 'Não informado';
    }

    return Array.from(roleFrequency.entries())
      .sort((firstRole, secondRole) => {
        if (secondRole[1] !== firstRole[1]) {
          return secondRole[1] - firstRole[1];
        }

        return firstRole[0].localeCompare(secondRole[0], 'pt-BR');
      })
      .map(([roleLabel]) => roleLabel)
      .slice(0, 3)
      .join(', ');
  }, [personCredits]);

  const knownForSourceMovies = useMemo(
    () => (castMovies.length > 0 ? castMovies : crewMovies),
    [castMovies, crewMovies]
  );

  const knownForMovies = useMemo(
    () => [...knownForSourceMovies].sort(compareCreditsByRelevance).slice(0, KNOWN_FOR_LIMIT),
    [knownForSourceMovies]
  );

  const knownForCarousel = useHorizontalCarousel(knownForMovies);

  const handleBackNavigation = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  const timelineMovies = useMemo(
    () => {
      const castCredits = Array.isArray(personCredits?.cast) ? personCredits.cast : [];
      const crewCredits = Array.isArray(personCredits?.crew) ? personCredits.crew : [];
      const creditsByMovieId = new Map();

      const upsertTimelineCredit = (credit, roleLabel) => {
        if (!credit?.id) {
          return;
        }

        const existingCredit = creditsByMovieId.get(credit.id);

        if (!existingCredit) {
          creditsByMovieId.set(credit.id, {
            credit,
            roleLabels: roleLabel ? [roleLabel] : [],
          });
          return;
        }

        if (compareCreditsByRelevance(credit, existingCredit.credit) < 0) {
          existingCredit.credit = credit;
        }

        if (roleLabel && !existingCredit.roleLabels.includes(roleLabel)) {
          existingCredit.roleLabels.push(roleLabel);
        }
      };

      castCredits.forEach((credit) => {
        upsertTimelineCredit(credit, getCastRoleLabel(credit));
      });

      crewCredits.forEach((credit) => {
        upsertTimelineCredit(credit, getCrewRoleLabel(credit));
      });

      return Array.from(creditsByMovieId.values())
        .map(({ credit, roleLabels }) => ({
          ...credit,
          timelineRoleLabels: roleLabels,
        }))
        .sort(compareCreditsByTimeline);
    },
    [personCredits]
  );

  const timelineGroups = useMemo(() => {
    const groupedByYear = new Map();

    timelineMovies.forEach((movie) => {
      const releaseYear = getReleaseYear(movie.release_date);

      if (!groupedByYear.has(releaseYear)) {
        groupedByYear.set(releaseYear, []);
      }

      groupedByYear.get(releaseYear).push(movie);
    });

    return Array.from(groupedByYear.entries()).map(([year, movies]) => ({
      year,
      movies,
    }));
  }, [timelineMovies]);

  const photoGallery = useMemo(() => {
    if (!Array.isArray(personImages) || personImages.length === 0) {
      return [];
    }

    return personImages
      .filter((image) => image?.file_path)
      .slice(0, 8);
  }, [personImages]);

  const photosCarousel = useHorizontalCarousel(photoGallery);

  if (isLoading) {
    return <PersonProfileSkeleton />;
  }

  if (pageError) {
    const friendlyMessage = pageError.status === 404
      ? 'Não encontramos este perfil de ator ou atriz.'
      : 'Não foi possível carregar o perfil agora.';

    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold">{friendlyMessage}</h1>
          <p className="mt-3 text-gray-400">Tente novamente em instantes.</p>
          <div className="mt-6 flex justify-center">
            <Link to="/" className="link-underline-action text-sm font-semibold">
              Voltar para o início
              <svg
                className="link-underline-action__icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!person) {
    return null;
  }

  const biography = person.biography?.trim() || 'Biografia não disponível em português no momento.';
  const hasLongBiography = biography.length > BIOGRAPHY_PREVIEW_LIMIT;
  const displayedBiography = hasLongBiography && !isBiographyExpanded
    ? `${biography.slice(0, BIOGRAPHY_PREVIEW_LIMIT).trimEnd()}...`
    : biography;

  const birthDetails = getBirthDetails(person.birthday, person.deathday);
  const placeOfBirth = person.place_of_birth?.trim() || 'Não informado';
  const knownForDepartment = getDepartmentLabel(person.known_for_department);
  const genderLabel = getGenderLabel(person.gender);
  const creditedWorksCount = String(timelineMovies.length);
  const alsoKnownAs = getAlsoKnownAs(person.also_known_as);
  const knownForLabel = getKnownForLabel(person.gender);

  const profileImage = buildTmdbImageUrl(person.profile_path, 'w500');
  const seoImage = profileImage || undefined;
  const seoDescription = biography;

  return (
    <>
      <PageSEO
        title={person.name}
        description={seoDescription}
        image={seoImage}
        url={`/person/${person.id}`}
        type="profile"
      />

      <div className="min-h-screen bg-black text-white pt-24 pb-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:gap-8 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-12">
            <aside className="lg:col-span-4 xl:col-span-3">
              <div className="space-y-4 lg:sticky lg:top-24 lg:flex lg:min-h-[calc(100vh-6rem)] lg:flex-col">
                <div className="overflow-hidden rounded-2xl bg-neutral-900/60 shadow-2xl shadow-black/50">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-800">
                      <span className="text-sm text-gray-400">Sem foto disponível</span>
                    </div>
                  )}
                </div>

                <section
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-4 md:p-5 lg:flex-1"
                  data-testid="person-profile-personal-info"
                >
                  <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">{person.name}</h1>

                  <h2 className="mt-5 text-lg font-semibold text-white">Informações pessoais</h2>
                  <dl className="mt-4 space-y-4">
                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Conhecido(a) por</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{knownForDepartment}</dd>
                    </div>

                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Também participou como</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{additionalParticipationRoles}</dd>
                    </div>

                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Creditado(a) em</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{creditedWorksCount}</dd>
                    </div>

                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gênero</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{genderLabel}</dd>
                    </div>

                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nascimento</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{birthDetails}</dd>
                    </div>

                    <div className="border-b border-neutral-800/80 pb-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Local de nascimento (em inglês)</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{placeOfBirth}</dd>
                    </div>

                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Também conhecido(a) como</dt>
                      <dd className="mt-1 text-sm text-gray-100 md:text-base">{alsoKnownAs}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </aside>

            <div className="lg:col-span-8 xl:col-span-9">
              <div className="space-y-10 lg:flex lg:min-h-[calc(100vh-6rem)] lg:flex-col lg:pr-2">
                <section>
                  <h2 className="text-xl font-semibold text-white md:text-2xl">Biografia</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-300 md:text-base">
                    {displayedBiography}
                  </p>
                  {hasLongBiography ? (
                    <button
                      type="button"
                      onClick={() => setIsBiographyExpanded((prevState) => !prevState)}
                      className="link-underline-action mt-4 text-sm font-semibold"
                    >
                      {isBiographyExpanded ? 'Ver menos' : 'Ver mais'}
                      <svg
                        className="link-underline-action__icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d={
                            isBiographyExpanded
                              ? 'M12 19V5M12 5L5 12M12 5L19 12'
                              : 'M5 12H19M19 12L12 5M19 12L12 19'
                          }
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </section>

                <section>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-white md:text-3xl">{knownForLabel}</h2>
                    </div>
                  </div>

                  {knownForMovies.length === 0 ? (
                    <div className="rounded-2xl bg-neutral-900/35 p-6 text-sm text-gray-400 md:text-base">
                      Nenhum crédito disponível para este perfil no momento.
                    </div>
                  ) : (
                    <div className="relative">
                      {knownForCarousel.canScrollLeft ? (
                        <button
                          type="button"
                          onClick={() => knownForCarousel.handleScroll('left')}
                          className={CAROUSEL_LEFT_ARROW_CLASS}
                          aria-label="Rolar carrossel para a esquerda"
                        >
                          <FaChevronLeft size={14} />
                        </button>
                      ) : null}

                      <div
                        ref={knownForCarousel.carouselRef}
                        className="flex gap-3 overflow-x-auto pb-3 pr-1 scrollbar-hide cursor-grab active:cursor-grabbing"
                        onMouseDown={knownForCarousel.handleMouseDown}
                        onClickCapture={knownForCarousel.handleClickCapture}
                      >
                        {knownForMovies.map((movie) => (
                          <div key={movie.id} className="w-32 flex-shrink-0 sm:w-36 md:w-40 lg:w-44">
                            <Link
                              to={`/movie/${movie.id}`}
                              aria-label={`Abrir detalhes de ${movie.title}`}
                              className="relative block group rounded-lg shadow-lg overflow-hidden aspect-[2/3] bg-neutral-800 transition-all duration-300 hover:shadow-2xl hover:shadow-tv-accent/20"
                            >
                              {movie.poster_path ? (
                                <img
                                  src={buildTmdbImageUrl(movie.poster_path, 'w500')}
                                  alt={movie.title}
                                  className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                                  draggable={false}
                                  onMouseDown={(event) => event.preventDefault()}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-gray-300">
                                  Poster não disponível
                                </div>
                              )}

                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out flex flex-col justify-end p-4">
                                <h3 className="line-clamp-2 text-lg font-semibold text-white mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
                                  {movie.title}
                                </h3>
                                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-in-out delay-100">
                                  <KnownForStarRating voteAverage={movie.vote_average} />
                                </div>
                              </div>
                            </Link>
                          </div>
                        ))}
                      </div>

                      {knownForCarousel.canScrollRight ? (
                        <button
                          type="button"
                          onClick={() => knownForCarousel.handleScroll('right')}
                          className={CAROUSEL_RIGHT_ARROW_CLASS}
                          aria-label="Rolar carrossel para a direita"
                        >
                          <FaChevronRight size={14} />
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>

                <section data-testid="person-profile-timeline">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-2xl font-bold text-white md:text-3xl">Linha do tempo</h2>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:text-sm">
                      {timelineMovies.length} obras
                    </p>
                  </div>

                  {timelineMovies.length === 0 ? (
                    <div className="rounded-2xl bg-neutral-900/35 p-6 text-sm text-gray-400 md:text-base">
                      Nenhuma obra encontrada para este perfil no momento.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timelineGroups.map((yearGroup) => (
                        <div
                          key={`timeline-year-${yearGroup.year}`}
                          className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-4 md:p-5"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:text-sm">
                            {yearGroup.year}
                          </p>

                          <div className="mt-3 space-y-2.5">
                            {yearGroup.movies.map((movie) => (
                              <div key={`timeline-credit-${movie.id}`} className="min-w-0">
                                <Link
                                  to={`/movie/${movie.id}`}
                                  className="block truncate text-sm font-semibold text-white transition-colors duration-200 hover:text-tv-accent md:text-base"
                                >
                                  {movie.title}
                                </Link>
                                <p className="mt-0.5 text-xs text-gray-400 md:text-sm">
                                  {Array.isArray(movie.timelineRoleLabels) && movie.timelineRoleLabels.length > 0
                                    ? movie.timelineRoleLabels.join(' · ')
                                    : 'participação não informada'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {photoGallery.length > 0 ? (
                  <section>
                    <h2 className="text-xl font-semibold text-white md:text-2xl">Fotos</h2>
                    <div className="relative mt-3">
                      {photosCarousel.canScrollLeft ? (
                        <button
                          type="button"
                          onClick={() => photosCarousel.handleScroll('left')}
                          className={CAROUSEL_LEFT_ARROW_CLASS}
                          aria-label="Rolar fotos para a esquerda"
                        >
                          <FaChevronLeft size={14} />
                        </button>
                      ) : null}

                      <div
                        ref={photosCarousel.carouselRef}
                        className="flex gap-3 overflow-x-auto pb-2 pr-1 scrollbar-hide cursor-grab active:cursor-grabbing"
                        onMouseDown={photosCarousel.handleMouseDown}
                        onClickCapture={photosCarousel.handleClickCapture}
                      >
                        {photoGallery.map((image) => (
                          <div
                            key={image.file_path}
                            className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-900 md:h-44 md:w-32"
                          >
                            <img
                              src={buildTmdbImageUrl(image.file_path, 'w300')}
                              alt={`Foto de ${person.name}`}
                              className="h-full w-full object-cover"
                              onMouseDown={(event) => event.preventDefault()}
                            />
                          </div>
                        ))}
                      </div>

                      {photosCarousel.canScrollRight ? (
                        <button
                          type="button"
                          onClick={() => photosCarousel.handleScroll('right')}
                          className={CAROUSEL_RIGHT_ARROW_CLASS}
                          aria-label="Rolar fotos para a direita"
                        >
                          <FaChevronRight size={14} />
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <div className="flex flex-wrap justify-center gap-3 pt-2 md:pt-4">
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    className={NAV_PRIMARY_BUTTON_CLASS}
                  >
                    <svg
                      className="h-4 w-0 -mr-1 -translate-x-1 text-gray-100 opacity-0 transition-all duration-200 group-hover:mr-0 group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-red-500 group-focus-visible:mr-0 group-focus-visible:w-4 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:text-red-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M19 12H5M5 12L12 5M5 12L12 19"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-gray-100 transition-colors duration-200 group-hover:text-red-500 group-focus-visible:text-red-500">
                      Voltar
                    </span>
                  </button>

                  <Link
                    to="/"
                    className={NAV_SECONDARY_BUTTON_CLASS}
                  >
                    <FaHome size={12} />
                    Ir para Início
                  </Link>
                </div>

                <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PersonProfile;
