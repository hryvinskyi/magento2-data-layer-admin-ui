<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionInterface;

/**
 * The wizard shell's own contribution: its wording and the shared browser modules every step plugin imports by name
 *
 * Both lists come from `di.xml`. The phrases are kept as written there and translated each time they are read, into
 * the locale of the request reading them: the object manager hands `di.xml` text over untranslated (marking it there
 * only lets the translation collector find it), and this object is shared, so a text translated once would keep the
 * first request's language. The shell adds no plugin and keeps no extension data.
 */
class CoreContribution implements SetupContributionInterface
{
    /**
     * @var array<string, string>
     */
    private readonly array $phrases;

    /**
     * @var array<string, string>
     */
    private readonly array $imports;

    /**
     * @param array<mixed> $phrases Text in the source language, keyed by phrase key
     * @param array<mixed> $imports File ids keyed by the name a module is imported by
     * @throws \InvalidArgumentException When a phrase or an import is not text keyed by text
     */
    public function __construct(array $phrases = [], array $imports = [])
    {
        $this->phrases = $this->texts('phrase', $phrases);
        $this->imports = $this->texts('import', $imports);
    }

    /**
     * @inheritDoc
     *
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getPhrases(): array
    {
        return array_map(static fn (string $text): string => (string) __($text), $this->phrases);
    }

    /**
     * @inheritDoc
     */
    public function getPlugins(): array
    {
        return [];
    }

    /**
     * @inheritDoc
     */
    public function getImports(): array
    {
        return $this->imports;
    }

    /**
     * @inheritDoc
     */
    public function getExtensionData(): array
    {
        return [];
    }

    /**
     * Check that every entry is text keyed by text
     *
     * @param string $what What the entries are, for the error
     * @param array<mixed> $entries
     * @return array<string, string>
     * @throws \InvalidArgumentException When an entry is not text keyed by text
     */
    private function texts(string $what, array $entries): array
    {
        $texts = [];
        foreach ($entries as $key => $text) {
            if (!is_string($key) || !is_string($text)) {
                throw new \InvalidArgumentException(
                    sprintf('The setup %s "%s" must be text keyed by text.', $what, (string) $key)
                );
            }
            $texts[$key] = $text;
        }

        return $texts;
    }
}
